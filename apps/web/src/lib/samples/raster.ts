/** Deterministic synthetic raster surfaces (single-band f32 COG via the existing writeRasterCog). */
import { writeRasterCog } from '../../engines/geolibre-io';
import { gridStats, type Grid } from '../grid';
import { mulberry32 } from './prng';

async function make(values: Float32Array, w: number, h: number): Promise<{ bytes: Uint8Array; grid: Grid }> {
  return { bytes: await writeRasterCog(values, w, h), grid: gridStats(values, w, h) };
}

/** A surface with carved closed depressions (for fill/breach depressions, extract sinks). */
export function demSinks(W = 256, H = 256): Float32Array {
  const v = new Float32Array(W * H);
  const r = mulberry32(5);
  const wells: Array<[number, number, number]> = [[0.3, 0.35, 22], [0.65, 0.55, 16], [0.5, 0.78, 13]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let z = 820 + 45 * Math.exp(-(((x - W * 0.4) ** 2 + (y - H * 0.45) ** 2)) / (2 * 60 * 60)) + 0.22 * x + 5 * (r() - 0.5);
      for (const [cx, cy, depth] of wells) {
        const d = Math.hypot(x - cx * W, y - cy * H);
        z -= depth * Math.exp(-(d * d) / (2 * 14 * 14));
      }
      v[y * W + x] = z;
    }
  }
  return v;
}

/** A near-conical peak (steep flanks) — a slope/aspect stress test. */
export function demCone(W = 200, H = 200): Float32Array {
  const v = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - W / 2, y - H / 2);
      v[y * W + x] = 800 + Math.max(0, W * 0.45 - d) * 1.7;
    }
  }
  return v;
}

/** Integer-coded land-cover classes in coherent blobs (for raster_to_vector_polygons, clump, zonal). */
export function landcover(W = 256, H = 256): Float32Array {
  const v = new Float32Array(W * H);
  const centers: Array<[number, number, number]> = [
    [0.2, 0.3, 1], [0.7, 0.25, 2], [0.5, 0.6, 3], [0.3, 0.78, 4], [0.82, 0.8, 5],
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = -1;
      let bc = 1;
      for (const [cx, cy, cls] of centers) {
        const wgt = Math.exp(-(((x - cx * W) ** 2 + (y - cy * H) ** 2)) / (2 * 62 * 62));
        if (wgt > best) {
          best = wgt;
          bc = cls;
        }
      }
      v[y * W + x] = bc;
    }
  }
  return v;
}

/** A smooth continuous scalar field (for reclass/threshold/raster math). */
export function continuousField(W = 200, H = 200): Float32Array {
  const v = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const t = y / H;
      v[y * W + x] = 15 + 10 * Math.sin(u * 6) * Math.cos(t * 5) + 8 * u;
    }
  }
  return v;
}

export const genDemSinks = (): Promise<{ bytes: Uint8Array; grid: Grid }> => make(demSinks(), 256, 256);
export const genDemCone = (): Promise<{ bytes: Uint8Array; grid: Grid }> => make(demCone(), 200, 200);
export const genLandcover = (): Promise<{ bytes: Uint8Array; grid: Grid }> => make(landcover(), 256, 256);
export const genContinuous = (): Promise<{ bytes: Uint8Array; grid: Grid }> => make(continuousField(), 200, 200);
