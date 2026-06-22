/** License tiers + known-engine provenance presets (dossier 05 §1, §4). */
import type { License, LicenseTier, Provenance } from './types.js';

const TIER_BY_SPDX: Record<string, LicenseTier> = {
  MIT: 'permissive',
  'X11': 'permissive',
  'Apache-2.0': 'permissive',
  'BSD-2-Clause': 'permissive',
  'BSD-3-Clause': 'permissive',
  'MPL-2.0': 'weak-copyleft',
  'LGPL-2.1': 'weak-copyleft',
  'LGPL-3.0': 'weak-copyleft',
  'EPL-2.0': 'weak-copyleft',
  'GPL-2.0': 'strong-copyleft',
  'GPL-3.0': 'strong-copyleft',
};

export function license(spdx: string): License {
  return { spdx, tier: TIER_BY_SPDX[spdx] ?? 'strong-copyleft' };
}

/** A strong-copyleft (GPL) tool must NOT be linked into the MIT core — keep it segregated/optional. */
export function mustSegregate(p: Provenance): boolean {
  return p.license.tier === 'strong-copyleft';
}

/** Provenance presets for the engines GeoLab integrates (versions filled by each adapter at load). */
export const ENGINES = {
  geolibre: (version?: string): Provenance => ({
    engine: 'geolibre',
    upstreamProject: 'WhiteboxTools / whitebox_next_gen / geolibre-rust',
    authors: 'John Lindsay; opengeos (Qiusheng Wu)',
    license: license('MIT'),
    version,
    url: 'https://github.com/opengeos/geolibre-rust',
  }),
  gdal: (version?: string): Provenance => ({
    engine: 'gdal',
    upstreamProject: 'GDAL/OGR (via gdal3.js)',
    authors: 'GDAL/OGR contributors; Buğra Sırmaçek (gdal3.js)',
    license: license('MIT'),
    version,
    url: 'https://github.com/bugra9/gdal3.js',
  }),
  geos: (version?: string): Provenance => ({
    engine: 'geos',
    upstreamProject: 'GEOS (via geos-wasm)',
    authors: 'GEOS / JTS contributors; Christoph Pahmeyer (geos-wasm)',
    license: license('LGPL-2.1'),
    version,
    url: 'https://github.com/chrispahm/geos-wasm',
  }),
  turf: (version?: string): Provenance => ({
    engine: 'turf',
    upstreamProject: 'Turf.js',
    authors: 'Turf.js contributors',
    license: license('MIT'),
    version,
    url: 'https://turfjs.org/',
  }),
  h3: (version?: string): Provenance => ({
    engine: 'h3',
    upstreamProject: 'Uber H3 (h3-js)',
    authors: 'Uber Technologies',
    license: license('Apache-2.0'),
    version,
    url: 'https://h3geo.org/',
  }),
  mapshaper: (version?: string): Provenance => ({
    engine: 'mapshaper',
    upstreamProject: 'mapshaper',
    authors: 'Matthew Bloch',
    license: license('MPL-2.0'),
    version,
    url: 'https://github.com/mbloch/mapshaper',
  }),
  geolab: (version?: string): Provenance => ({
    engine: 'geolab',
    upstreamProject: 'GeoLab (own tools)',
    authors: 'Felipe Santibañez-Leal',
    license: license('MIT'),
    version,
    url: 'https://github.com/fsantibanezleal/CAOS_GEOLAB',
  }),
} as const;
