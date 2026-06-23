/** A 2-D scalar raster grid + its value range, for rendering and value read-out. */
export interface Grid {
  values: Float32Array;
  width: number;
  height: number;
  min: number;
  max: number;
}

export function gridStats(values: Float32Array, width: number, height: number): Grid {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  return { values, width, height, min, max };
}
