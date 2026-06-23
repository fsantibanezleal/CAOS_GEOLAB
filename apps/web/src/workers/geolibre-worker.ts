/**
 * Web Worker: runs geolibre-wasm tools off the main thread so the UI stays responsive.
 *
 * Protocol (postMessage):
 *   IN  { type: 'RUN'; id: number; toolId: string; args: string[]; input: Record<string, Uint8Array> }
 *   OUT { type: 'PROGRESS'; id: number; fraction: number; message: string }
 *     | { type: 'RESULT';   id: number; files: Record<string, Uint8Array>; log: string[] }
 *     | { type: 'ERROR';    id: number; message: string }
 *
 * The engine is loaded once and reused across all RUN messages (warm subsequent runs).
 */

import type { GeolibreToolsModule } from '@geolab/adapter-geolibre';

// Cast self to a plain object to avoid DOM ↔ WebWorker type conflicts.
const workerCtx = self as unknown as {
  addEventListener(type: 'message', fn: (e: MessageEvent) => void): void;
  postMessage(msg: unknown, transfer?: Transferable[]): void;
};

type InMsg = {
  type: 'RUN';
  id: number;
  toolId: string;
  args: string[];
  input: Record<string, Uint8Array>;
};

function send(msg: unknown, transfer?: Transferable[]): void {
  workerCtx.postMessage(msg, transfer);
}

let enginePromise: Promise<GeolibreToolsModule> | null = null;

function ensureEngine(): Promise<GeolibreToolsModule> {
  if (!enginePromise) {
    enginePromise = (import('geolibre-wasm/tools') as Promise<unknown>).then((m) => m as GeolibreToolsModule);
  }
  return enginePromise;
}

workerCtx.addEventListener('message', (e: MessageEvent<InMsg>) => {
  const { type, id, toolId, args, input } = e.data;
  if (type !== 'RUN') return;

  void (async () => {
    try {
      send({ type: 'PROGRESS', id, fraction: 0.05, message: 'loading engine…' });
      const engine = await ensureEngine();
      send({ type: 'PROGRESS', id, fraction: 0.1, message: `running ${toolId}…` });

      const res = await engine.runTool(toolId, { args, input });

      if (res.exitCode !== 0) {
        throw new Error(`geolibre "${toolId}" exited ${res.exitCode}: ${res.stdout.join(' ').slice(0, 400)}`);
      }

      send({ type: 'PROGRESS', id, fraction: 0.95, message: 'transferring results…' });

      // Transfer output Uint8Array buffers zero-copy to the main thread.
      const files = res.files as Record<string, Uint8Array>;
      const transferList: ArrayBuffer[] = Object.values(files)
        .map((b) => b.buffer)
        .filter((buf): buf is ArrayBuffer => buf instanceof ArrayBuffer);

      send({ type: 'RESULT', id, files, log: res.stdout }, transferList);
    } catch (err) {
      send({ type: 'ERROR', id, message: err instanceof Error ? err.message : String(err) });
    }
  })();
});
