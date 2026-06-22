import { writeRasterCog } from '../engines/geolibre-io';
import { gridStats, type Grid } from './grid';

/** A deterministic synthetic DEM (two Gaussian hills + a gentle tilt), as a georeferenced COG (30 m, UTM 19S). */
export async function writeSyntheticDem(width = 240, height = 240): Promise<{ bytes: Uint8Array; grid: Grid }> {
  const values = new Float32Array(width * height);
  const s1 = width * 0.16;
  const s2 = width * 0.1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r1 = Math.hypot(x - width * 0.35, y - height * 0.4);
      const r2 = Math.hypot(x - width * 0.7, y - height * 0.66);
      values[y * width + x] =
        820 + 360 * Math.exp(-(r1 * r1) / (2 * s1 * s1)) + 230 * Math.exp(-(r2 * r2) / (2 * s2 * s2)) + 0.35 * x;
    }
  }
  const bytes = await writeRasterCog(values, width, height);
  return { bytes, grid: gridStats(values, width, height) };
}
