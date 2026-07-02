import { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Grid } from '../lib/grid';
import type { RGB } from '../lib/colormap';
import type { GeoJSONFeatureCollection } from '../lib/geojson';

interface Props {
  grid: Grid | null;
  colormap: (t: number) => RGB;
  lonLatBbox: [number, number, number, number] | null;
  geojson?: GeoJSONFeatureCollection | null;
  geoBbox?: [number, number, number, number] | null;
  title?: string;
  opacity?: number;
}

const RST_SRC = 'geolab-raster';
const RST_LYR = 'geolab-raster-layer';
const VEC_SRC = 'geolab-vector';
const VEC_FILL = 'geolab-vec-fill';
const VEC_LINE = 'geolab-vec-line';
const VEC_CIRCLE = 'geolab-vec-circle';

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
} as maplibregl.StyleSpecification;

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

function clearRaster(map: maplibregl.Map) {
  if (map.getLayer(RST_LYR)) map.removeLayer(RST_LYR);
  if (map.getSource(RST_SRC)) map.removeSource(RST_SRC);
}

function clearVector(map: maplibregl.Map) {
  for (const id of [VEC_FILL, VEC_LINE, VEC_CIRCLE]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(VEC_SRC)) map.removeSource(VEC_SRC);
}

function applyRasterOverlay(
  map: maplibregl.Map,
  dataUrl: string,
  bbox: [number, number, number, number],
  opacity: number,
) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
    [minLon, maxLat], [maxLon, maxLat], [maxLon, minLat], [minLon, minLat],
  ];
  clearRaster(map);
  map.addSource(RST_SRC, { type: 'image', url: dataUrl, coordinates });
  map.addLayer({ id: RST_LYR, type: 'raster', source: RST_SRC, paint: { 'raster-opacity': opacity } });
  map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 60, animate: false, maxZoom: 16 });
}

function applyVectorOverlay(
  map: maplibregl.Map,
  geojson: GeoJSONFeatureCollection,
  bbox: [number, number, number, number],
) {
  const src = map.getSource(VEC_SRC) as GeoJSONSource | undefined;
  if (src) {
    src.setData(geojson as unknown as Parameters<GeoJSONSource['setData']>[0]);
  } else {
    map.addSource(VEC_SRC, { type: 'geojson', data: geojson as unknown as Parameters<GeoJSONSource['setData']>[0] });
    map.addLayer({
      id: VEC_FILL, type: 'fill', source: VEC_SRC,
      filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
      paint: { 'fill-color': '#0ea875', 'fill-opacity': 0.3 },
    });
    map.addLayer({
      id: VEC_LINE, type: 'line', source: VEC_SRC,
      filter: ['any',
        ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
        ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
      ],
      paint: { 'line-color': '#0ea875', 'line-width': 1.5 },
    });
    map.addLayer({
      id: VEC_CIRCLE, type: 'circle', source: VEC_SRC,
      filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
      paint: {
        'circle-color': '#0ea875', 'circle-radius': 5,
        'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5,
      },
    });
  }
  const [minLon, minLat, maxLon, maxLat] = bbox;
  // Expand tiny bboxes (single point) so fitBounds works.
  const pad = 0.001;
  map.fitBounds(
    [[minLon - pad, minLat - pad], [maxLon + pad, maxLat + pad]],
    { padding: 60, animate: false, maxZoom: 14 },
  );
}

export function MapView({ grid, colormap, lonLatBbox, geojson, geoBbox, title, opacity = 0.85 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pendingRasterRef = useRef<{ dataUrl: string; bbox: [number, number, number, number] } | null>(null);
  const pendingVecRef = useRef<{ geojson: GeoJSONFeatureCollection; bbox: [number, number, number, number] } | null>(null);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [0, 20],
      zoom: 1,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      const pr = pendingRasterRef.current;
      if (pr) { applyRasterOverlay(map, pr.dataUrl, pr.bbox, opacity); pendingRasterRef.current = null; }
      const pv = pendingVecRef.current;
      if (pv) { applyVectorOverlay(map, pv.geojson, pv.bbox); pendingVecRef.current = null; }
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Raster overlay — clear vector first.
  useEffect(() => {
    if (!grid || !lonLatBbox) return;
    const dataUrl = gridToDataUrl(grid, colormap);
    const map = mapRef.current;
    if (!map?.loaded()) { pendingRasterRef.current = { dataUrl, bbox: lonLatBbox }; return; }
    clearVector(map);
    applyRasterOverlay(map, dataUrl, lonLatBbox, opacity);
  }, [grid, colormap, lonLatBbox, opacity]);

  // Vector overlay — clear raster first.
  useEffect(() => {
    if (!geojson || !geoBbox) return;
    const map = mapRef.current;
    if (!map?.loaded()) { pendingVecRef.current = { geojson, bbox: geoBbox }; return; }
    clearRaster(map);
    applyVectorOverlay(map, geojson, geoBbox);
  }, [geojson, geoBbox]);

  const hasData = grid || geojson;
  const noGeoHint = grid && !lonLatBbox;

  return (
    <div className="mapview">
      {title && <div className="rtitle">{title}</div>}
      <div ref={containerRef} className="maplibre-wrap" />
      {noGeoHint && <div className="map-no-geo">No spatial reference — cannot place on basemap</div>}
      {!hasData && <div className="map-no-geo">Generate or upload a layer to see it on the map</div>}
    </div>
  );
}
