/** Deterministic synthetic vector samples (GeoJSON, EPSG:4326) over a small AOI near the raster footprint. */
import { mulberry32, round } from './prng';
import type { GeoJSONFeature, GeoJSONFeatureCollection } from '../geojson';

// AOI in lon/lat near the synthetic raster footprint (UTM 19S 500000E/6000000N ≈ lon −69, lat −36.2).
const LON0 = -69.0;
const LAT0 = -36.22;
const DLON = 0.07;
const DLAT = 0.065;

const feat = (geometry: { type: string; coordinates: unknown }, properties: Record<string, unknown>): GeoJSONFeature => ({
  type: 'Feature',
  geometry,
  properties,
});
const fc = (features: GeoJSONFeature[]): GeoJSONFeatureCollection => ({ type: 'FeatureCollection', features });

export function ptsRandom(n = 200, seed = 3): GeoJSONFeatureCollection {
  const r = mulberry32(seed);
  const out: GeoJSONFeature[] = [];
  for (let i = 0; i < n; i++) {
    out.push(feat({ type: 'Point', coordinates: [round(LON0 + r() * DLON), round(LAT0 + r() * DLAT)] }, { id: i }));
  }
  return fc(out);
}

/** Points carrying a spatially-autocorrelated numeric `value` (for IDW / kriging / variogram + the field selector). */
export function ptsValue(n = 250, seed = 7): GeoJSONFeatureCollection {
  const r = mulberry32(seed);
  const cats = ['A', 'B', 'C'];
  const out: GeoJSONFeature[] = [];
  for (let i = 0; i < n; i++) {
    const lon = LON0 + r() * DLON;
    const lat = LAT0 + r() * DLAT;
    const u = (lon - LON0) / DLON;
    const v = (lat - LAT0) / DLAT;
    const value = 100 + 60 * Math.sin(u * 3.1) * Math.cos(v * 2.3) + 25 * (u + v) + 8 * (r() - 0.5);
    out.push(feat({ type: 'Point', coordinates: [round(lon), round(lat)] }, { id: i, value: round(value, 2), category: cats[Math.floor(r() * 3)] ?? 'A' }));
  }
  return fc(out);
}

export function polysParcels(seed = 11): GeoJSONFeatureCollection {
  const r = mulberry32(seed);
  const cells = 6;
  const cw = DLON / cells;
  const ch = DLAT / cells;
  const zones = ['res', 'com', 'ind'];
  const out: GeoJSONFeature[] = [];
  let id = 0;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const x0 = LON0 + i * cw;
      const y0 = LAT0 + j * ch;
      const ring = [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch], [x0, y0]].map(([a, b]) => [round(a ?? 0), round(b ?? 0)]);
      out.push(feat({ type: 'Polygon', coordinates: [ring] }, { id: id++, zone: zones[Math.floor(r() * 3)] ?? 'res', area_ha: round(50 + r() * 50, 1) }));
    }
  }
  return fc(out);
}

export function linesNetwork(seed = 13): GeoJSONFeatureCollection {
  const r = mulberry32(seed);
  const out: GeoJSONFeature[] = [];
  for (let k = 0; k < 12; k++) {
    const n = 4 + Math.floor(r() * 5);
    let lon = LON0 + r() * DLON;
    let lat = LAT0 + r() * DLAT;
    const coords: number[][] = [[round(lon), round(lat)]];
    for (let s = 1; s < n; s++) {
      lon += (r() - 0.5) * DLON * 0.3;
      lat += (r() - 0.5) * DLAT * 0.3;
      coords.push([round(lon), round(lat)]);
    }
    out.push(feat({ type: 'LineString', coordinates: coords }, { id: k, klass: r() > 0.5 ? 'road' : 'stream' }));
  }
  return fc(out);
}

export function polysOverlap(seed = 17): GeoJSONFeatureCollection {
  const r = mulberry32(seed);
  const out: GeoJSONFeature[] = [];
  for (let k = 0; k < 10; k++) {
    const cx = LON0 + (0.2 + r() * 0.6) * DLON;
    const cy = LAT0 + (0.2 + r() * 0.6) * DLAT;
    const rad = (0.08 + r() * 0.06) * Math.min(DLON, DLAT);
    const ring: number[][] = [];
    for (let a = 0; a <= 12; a++) {
      const tt = (a / 12) * 2 * Math.PI;
      ring.push([round(cx + rad * Math.cos(tt)), round(cy + rad * Math.sin(tt))]);
    }
    out.push(feat({ type: 'Polygon', coordinates: [ring] }, { id: k, grp: k % 2 }));
  }
  return fc(out);
}

export function bboxExtent(): GeoJSONFeatureCollection {
  const x0 = LON0 + 0.1 * DLON;
  const y0 = LAT0 + 0.1 * DLAT;
  const x1 = LON0 + 0.9 * DLON;
  const y1 = LAT0 + 0.9 * DLAT;
  const ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([a, b]) => [round(a ?? 0), round(b ?? 0)]);
  return fc([feat({ type: 'Polygon', coordinates: [ring] }, { name: 'AOI' })]);
}

export function geojsonToBytes(collection: GeoJSONFeatureCollection): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(collection));
}
