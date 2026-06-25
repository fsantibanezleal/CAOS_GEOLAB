/** Deterministic synthetic CSV tables. */
import { mulberry32, round } from './prng';

const LON0 = -69.0;
const LAT0 = -36.22;
const DLON = 0.07;
const DLAT = 0.065;

/** X/Y/value table (same field structure as the points-with-value sample). */
export function csvXyz(n = 300, seed = 29): Uint8Array {
  const r = mulberry32(seed);
  const rows = ['x,y,value'];
  for (let i = 0; i < n; i++) {
    const lon = LON0 + r() * DLON;
    const lat = LAT0 + r() * DLAT;
    const u = (lon - LON0) / DLON;
    const v = (lat - LAT0) / DLAT;
    const value = 100 + 60 * Math.sin(u * 3.1) * Math.cos(v * 2.3) + 25 * (u + v);
    rows.push(`${round(lon)},${round(lat)},${round(value, 2)}`);
  }
  return new TextEncoder().encode(rows.join('\n'));
}
