/** The Tool registry — the single place every engine's tools (and our own) are registered + searched. */
import type { Tool, ToolCategory } from './types.js';

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  /** Register a tool. Throws on duplicate id so engine adapters can't silently shadow each other. */
  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`GeoLab: duplicate tool id "${tool.id}" (from engine "${tool.provenance.engine}")`);
    }
    this.tools.set(tool.id, tool);
  }

  registerAll(tools: Iterable<Tool>): void {
    for (const t of tools) this.register(t);
  }

  get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  byCategory(category: ToolCategory): Tool[] {
    return this.list().filter((t) => t.category === category);
  }

  byEngine(engine: string): Tool[] {
    return this.list().filter((t) => t.provenance.engine === engine);
  }

  /** Free-text search over id / name / summary / tags. */
  search(query: string): Tool[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list();
    return this.list().filter((t) =>
      [t.id, t.name, t.summary, ...(t.tags ?? [])].some((s) => s.toLowerCase().includes(q)),
    );
  }

  get size(): number {
    return this.tools.size;
  }

  /** Tool counts grouped by source engine — powers the "1,000+ tools across N engines" headline + Credits. */
  countsByEngine(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const t of this.tools.values()) out[t.provenance.engine] = (out[t.provenance.engine] ?? 0) + 1;
    return out;
  }
}
