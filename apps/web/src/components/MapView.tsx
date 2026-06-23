import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Grid } from '../lib/grid';
import type { RGB } from '../lib/colormap';

interface Props {
  grid: Grid | null;
  colormap: (t: number) => RGB;
  lonLatBbox: [number, number, number, number] | null;
  title?: string;
  opacity?: number;
}

const SRC_ID = 'geolab-raster';
const LYR_ID = 'geolab-raster-layer';

/** Render the grid + colormap to an offscreen canvas and return a PNG data URL. */
function gridToDataUrl(grid: Grid, colormap: (t: number) => RGB): string {
  const cv = document.createElement('canvas');
  cv.width = grid.width;
  cv.height = grid.height;
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
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
    img.data[j + 3] = 220;
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}

function applyOverlay(
  map: maplibregl.Map,
  dataUrl: string,
  bbox: [number, number, number, number],
  opacity: number,
) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
    [minLon, maxLat],
    [maxLon, maxLat],
    [maxLon, minLat],
    [minLon, minLat],
  ];

  if (map.getLayer(LYR_ID)) map.removeLayer(LYR_ID);
  if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);

  map.addSource(SRC_ID, { type: 'image', url: dataUrl, coordinates });
  map.addLayer({ id: LYR_ID, type: 'raster', source: SRC_ID, paint: { 'raster-opacity': opacity } });
  map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 60, animate: false, maxZoom: 16 });
}

export function MapView({ grid, colormap, lonLatBbox, title, opacity = 0.85 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pendingRef = useRef<{ dataUrl: string; bbox: [number, number, number, number] } | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [0, 20],
      zoom: 1,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      const p = pendingRef.current;
      if (p) {
        applyOverlay(map, p.dataUrl, p.bbox, opacity);
        pendingRef.current = null;
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!grid || !lonLatBbox) return;
    const dataUrl = gridToDataUrl(grid, colormap);
    const map = mapRef.current;

    if (!map || !map.loaded()) {
      pendingRef.current = { dataUrl, bbox: lonLatBbox };
      return;
    }
    applyOverlay(map, dataUrl, lonLatBbox, opacity);
  }, [grid, colormap, lonLatBbox, opacity]);

  return (
    <div className="mapview">
      {title && <div className="rtitle">{title}</div>}
      <div ref={containerRef} className="maplibre-wrap" />
      {grid && !lonLatBbox && (
        <div className="map-no-geo">No spatial reference — cannot place on basemap</div>
      )}
      {!grid && <div className="map-no-geo">Generate or upload a raster to see it on the map</div>}
    </div>
  );
}
