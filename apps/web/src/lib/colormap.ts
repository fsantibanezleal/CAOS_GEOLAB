export type RGB = [number, number, number];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function rampFn(stops: Array<[number, RGB]>): (t: number) => RGB {
  return (t: number): RGB => {
    const x = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
    for (let i = 1; i < stops.length; i++) {
      const cur = stops[i];
      const prev = stops[i - 1];
      if (!cur || !prev) break;
      const [p1, c1] = cur;
      const [p0, c0] = prev;
      if (x <= p1) {
        const u = (x - p0) / (p1 - p0 || 1);
        return [Math.round(lerp(c0[0], c1[0], u)), Math.round(lerp(c0[1], c1[1], u)), Math.round(lerp(c0[2], c1[2], u))];
      }
    }
    return stops[stops.length - 1]?.[1] ?? [0, 0, 0];
  };
}

/** Elevation ramp (water/low → green → tan → brown → snow). */
export const TERRAIN = rampFn([
  [0, [58, 84, 120]],
  [0.15, [74, 124, 89]],
  [0.45, [150, 166, 98]],
  [0.7, [150, 120, 80]],
  [0.9, [120, 90, 70]],
  [1, [245, 245, 245]],
]);

/** Sequential ramp for derived quantities (slope, etc.). */
export const VIRIDIS = rampFn([
  [0, [68, 1, 84]],
  [0.25, [59, 82, 139]],
  [0.5, [33, 145, 140]],
  [0.75, [94, 201, 98]],
  [1, [253, 231, 37]],
]);

/** Neutral grayscale. */
export const GRAY = rampFn([
  [0, [12, 14, 16]],
  [1, [244, 246, 248]],
]);

/** Named colormap registry for the layer renderer. */
export const CMAPS: Record<string, (t: number) => RGB> = { viridis: VIRIDIS, terrain: TERRAIN, gray: GRAY };
export type CmapName = keyof typeof CMAPS;
