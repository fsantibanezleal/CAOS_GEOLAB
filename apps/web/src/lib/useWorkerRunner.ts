/**
 * useWorkerRunner — runs a geolibre tool in a Web Worker, keeping the main thread responsive.
 * Exposes progress (fraction 0-1 + message), cancellation, and a stable `run` function.
 *
 * One worker is shared across all hook instances (module-level singleton). The engine loads once
 * inside the worker on the first RUN and stays warm for subsequent calls.
 */

import { useCallback, useRef, useState } from 'react';
import { collectRunArgs, guessOutputKind, type GeolibreManifest } from '@geolab/adapter-geolibre';
import type { Layer, PortKind, VirtualFS } from '@geolab/tool-core';

export type RunnerState = 'idle' | 'running';

export interface RunProgress {
  fraction: number;
  message: string;
}

export interface WorkerOutputFile {
  name: string;
  kind: PortKind;
  bytes: Uint8Array;
  format?: string;
}

export interface WorkerRunResult {
  outputs: WorkerOutputFile[];
  log: string[];
}

// ── module-level singleton worker ──────────────────────────────────────────

let _worker: Worker | null = null;

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL('../workers/geolibre-worker.ts', import.meta.url), { type: 'module' });
    // Terminate-and-recreate on unexpected error so the next run starts fresh.
    _worker.addEventListener('error', () => {
      _worker?.terminate();
      _worker = null;
    });
  }
  return _worker;
}

// ── hook ───────────────────────────────────────────────────────────────────

export function useWorkerRunner() {
  const [state, setState] = useState<RunnerState>('idle');
  const [progress, setProgress] = useState<RunProgress>({ fraction: 0, message: '' });
  const abortedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    abortedRef.current = true;
    cleanupRef.current?.();
    cleanupRef.current = null;
    setState('idle');
    setProgress({ fraction: 0, message: '' });
  }, []);

  const run = useCallback(
    async (
      manifest: GeolibreManifest,
      values: Record<string, unknown>,
      layers: Layer[],
      fs: VirtualFS,
    ): Promise<WorkerRunResult> => {
      abortedRef.current = false;
      setState('running');
      setProgress({ fraction: 0.01, message: 'preparing…' });

      // Build args + gather input bytes on the main thread (async FS reads).
      const getLayer = (id: string) => layers.find((l) => l.id === id);
      const { args, input } = await collectRunArgs(manifest, values, getLayer, (ref) => fs.read(ref));

      const worker = getWorker();
      const msgId = Date.now();

      return new Promise<WorkerRunResult>((resolve, reject) => {
        // Copy each input buffer so the InMemoryFS originals stay intact after transfer.
        const safeInput: Record<string, Uint8Array> = {};
        const transferList: ArrayBuffer[] = [];
        for (const [fname, bytes] of Object.entries(input)) {
          const copy = new Uint8Array(bytes); // new underlying ArrayBuffer
          safeInput[fname] = copy;
          transferList.push(copy.buffer as ArrayBuffer);
        }

        const handler = (e: MessageEvent) => {
          const msg = e.data as {
            type: string;
            id: number;
            fraction?: number;
            message?: string;
            files?: Record<string, Uint8Array>;
            log?: string[];
          };
          if (msg.id !== msgId) return;

          if (msg.type === 'PROGRESS') {
            if (!abortedRef.current) {
              setProgress({ fraction: msg.fraction ?? 0, message: msg.message ?? '' });
            }
          } else if (msg.type === 'RESULT') {
            worker.removeEventListener('message', handler);
            cleanupRef.current = null;
            if (abortedRef.current) {
              reject(new Error('Cancelled'));
              return;
            }
            setState('idle');
            setProgress({ fraction: 0, message: '' });

            const files = msg.files ?? {};
            const outputs: WorkerOutputFile[] = Object.entries(files).map(([name, bytes]) => ({
              name,
              kind: guessOutputKind(name) as PortKind,
              bytes: bytes as Uint8Array,
              format: /\.tif$/i.test(name) ? 'COG' : undefined,
            }));
            resolve({ outputs, log: msg.log ?? [] });
          } else if (msg.type === 'ERROR') {
            worker.removeEventListener('message', handler);
            cleanupRef.current = null;
            if (!abortedRef.current) {
              setState('idle');
              setProgress({ fraction: 0, message: '' });
              reject(new Error((msg.message as string | undefined) ?? 'Unknown worker error'));
            }
          }
        };

        cleanupRef.current = () => worker.removeEventListener('message', handler);
        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'RUN', id: msgId, toolId: manifest.id, args, input: safeInput }, transferList);
      });
    },
    [],
  );

  return { state, progress, run, cancel };
}
