/**
 * H3 engine — loads the H3 tool catalog synchronously (pure JS, no WASM).
 * All 8 tools run on the main thread via Tool.run().
 */

import { buildH3Tools } from '@geolab/adapter-h3';
import type { Tool } from '@geolab/tool-core';

let _cache: Tool[] | null = null;

export function loadH3Tools(): Tool[] {
  if (!_cache) _cache = buildH3Tools();
  return _cache;
}
