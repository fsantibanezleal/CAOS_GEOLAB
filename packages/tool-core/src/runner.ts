/**
 * Pipeline runner contract. The real implementation runs each tool in a Web Worker, streams progress,
 * supports cancel, and memoises intermediates by hash(inputs+params+toolVersion) (dossier 04 §4).
 * This module defines the interface + a topological order helper so the executor is engine-agnostic.
 */
import type { Pipeline, ToolRunResult } from './types.js';

export interface RunHooks {
  onNodeStart?(nodeId: string): void;
  onNodeProgress?(nodeId: string, fraction: number, message?: string): void;
  onNodeDone?(nodeId: string, result: ToolRunResult): void;
  onNodeError?(nodeId: string, error: unknown): void;
}

export interface PipelineRunner {
  run(pipeline: Pipeline, signal: AbortSignal, hooks?: RunHooks): Promise<Map<string, ToolRunResult>>;
}

/**
 * Kahn topological sort of a pipeline DAG → execution order. Throws on a cycle (a pipeline must be acyclic).
 */
export function topologicalOrder(pipeline: Pipeline): string[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of pipeline.nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of pipeline.edges) {
    adj.get(e.from.node)?.push(e.to.node);
    indeg.set(e.to.node, (indeg.get(e.to.node) ?? 0) + 1);
  }
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (order.length !== pipeline.nodes.length) {
    throw new Error('GeoLab: pipeline has a cycle — a pipeline must be a DAG.');
  }
  return order;
}
