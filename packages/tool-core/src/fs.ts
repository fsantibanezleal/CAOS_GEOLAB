import type { VirtualFS } from './types.js';

/** A simple in-memory {@link VirtualFS}. Inputs are seeded with `set()`; tools read/write by path. */
export class InMemoryFS implements VirtualFS {
  private store = new Map<string, Uint8Array>();

  async read(path: string): Promise<Uint8Array> {
    const v = this.store.get(path);
    if (!v) throw new Error(`InMemoryFS: file not found: ${path}`);
    return v;
  }
  async write(path: string, bytes: Uint8Array): Promise<void> {
    this.store.set(path, bytes);
  }
  async exists(path: string): Promise<boolean> {
    return this.store.has(path);
  }
  async remove(path: string): Promise<void> {
    this.store.delete(path);
  }

  /** Synchronous seed of an input file. */
  set(path: string, bytes: Uint8Array): void {
    this.store.set(path, bytes);
  }
  keys(): string[] {
    return [...this.store.keys()];
  }
}
