import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Grid } from '../lib/grid';
import type { RGB } from '../lib/colormap';

interface Props {
  grid: Grid;
  colormap: (t: number) => RGB;
  unit?: string;
  decimals?: number;
  title?: string;
}

/** A CSS gradient sampling the colormap, for the legend bar. */
function gradientCss(cmap: (t: number) => RGB): string {
  const stops: string[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [r, g, b] = cmap(t);
    stops.push(`rgb(${r},${g},${b}) ${((t * 100) | 0)}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** Renders a raster grid to a canvas with a colormap + a value read-out at the cursor (interactivity rubric). */
export function RasterCanvas({ grid, colormap, unit, decimals = 1, title }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; v: number } | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = grid.width;
    cv.height = grid.height;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(grid.width, grid.height);
    const span = grid.max - grid.min || 1;
    for (let i = 0; i < grid.values.length; i++) {
      const v = grid.values[i] ?? NaN;
      const t = Number.isFinite(v) ? (v - grid.min) / span : 0;
      const [r, g, b] = colormap(t);
      const j = i * 4;
      img.data[j] = r;
      img.data[j + 1] = g;
      img.data[j + 2] = b;
      img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [grid, colormap]);

  function onMove(e: MouseEvent<HTMLCanvasElement>) {
    const cv = ref.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const px = Math.floor(((e.clientX - rect.left) / rect.width) * grid.width);
    const py = Math.floor(((e.clientY - rect.top) / rect.height) * grid.height);
    if (px < 0 || py < 0 || px >= grid.width || py >= grid.height) {
      setHover(null);
      return;
    }
    setHover({ x: px, y: py, v: grid.values[py * grid.width + px] ?? NaN });
  }

  return (
    <div className="rcanvas">
      {title && <div className="rtitle">{title}</div>}
      <canvas ref={ref} className="rgrid" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      <div className="rreadout">
        {hover ? (
          <span>
            [{hover.x},{hover.y}] <strong>{Number.isFinite(hover.v) ? hover.v.toFixed(decimals) : '—'}</strong>
            {unit ? ` ${unit}` : ''}
          </span>
        ) : (
          <span className="muted">hover to read values</span>
        )}
      </div>
      <div className="colorbar">
        <div className="cbar" style={{ background: gradientCss(colormap) }} />
        <div className="cbar-labels">
          <span>{grid.min.toFixed(decimals)}</span>
          <span>{((grid.min + grid.max) / 2).toFixed(decimals)}</span>
          <span>
            {grid.max.toFixed(decimals)}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
