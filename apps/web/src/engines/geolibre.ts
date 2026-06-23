import { buildGeolibreTools, type GeolibreManifest, type GeolibreToolsModule } from '@geolab/adapter-geolibre';
import type { Tool } from '@geolab/tool-core';

/**
 * Lazily load the geolibre-wasm engine (≈22 MB WASM, runs in-browser) and return its 747 tools as GeoLab
 * `Tool`s. The WASM is fetched + compiled only on the first call (so it never weighs on first paint).
 * Also populates the manifest cache used by {@link getGeolibreManifest}.
 */
let cache: Promise<Tool[]> | null = null;
let _manifests: GeolibreManifest[] = [];

export function loadGeolibreTools(): Promise<Tool[]> {
  if (!cache) {
    cache = (async () => {
      const mod = (await import('geolibre-wasm/tools')) as unknown as GeolibreToolsModule;
      const manifests = await mod.listManifests();
      _manifests = manifests;
      return buildGeolibreTools(manifests, mod);
    })();
  }
  return cache;
}

/** Return the raw geolibre manifest for a GeoLab tool id (e.g. "geolibre:Slope" → the Slope manifest). */
export function getGeolibreManifest(geolabtoolId: string): GeolibreManifest | undefined {
  const rawId = geolabtoolId.replace(/^geolibre:/, '');
  return _manifests.find((m) => m.id === rawId);
}
