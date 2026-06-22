import { buildGeolibreTools, type GeolibreToolsModule } from '@geolab/adapter-geolibre';
import type { Tool } from '@geolab/tool-core';

/**
 * Lazily load the geolibre-wasm engine (≈22 MB WASM, runs in-browser) and return its 747 tools as GeoLab
 * `Tool`s. The WASM is fetched + compiled only on the first call (so it never weighs on first paint).
 */
let cache: Promise<Tool[]> | null = null;

export function loadGeolibreTools(): Promise<Tool[]> {
  if (!cache) {
    cache = (async () => {
      const mod = (await import('geolibre-wasm/tools')) as unknown as GeolibreToolsModule;
      const manifests = await mod.listManifests();
      return buildGeolibreTools(manifests, mod);
    })();
  }
  return cache;
}
