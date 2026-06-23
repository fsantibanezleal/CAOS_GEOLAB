/**
 * Turf engine — loads the Turf.js tool catalog synchronously (no WASM, no lazy import).
 * All 16 tools are pure-JS and run on the main thread via Tool.run().
 */

import { buildTurfTools } from '@geolab/adapter-turf';
import type { Tool } from '@geolab/tool-core';

let _cache: Tool[] | null = null;

export function loadTurfTools(): Tool[] {
  if (!_cache) _cache = buildTurfTools();
  return _cache;
}
