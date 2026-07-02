/** GeoJSON utilities — parse, bbox, summary. Used for rendering vector tool outputs. */

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONGeometry | null;
  properties: Record<string, unknown> | null;
}

export interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

/** Decode bytes as UTF-8 JSON and normalise to a FeatureCollection. */
export function parseGeoJSON(bytes: Uint8Array): GeoJSONFeatureCollection {
  const text = new TextDecoder().decode(bytes);
  const obj = JSON.parse(text) as Record<string, unknown>;
  if (obj.type === 'Feature') {
    return { type: 'FeatureCollection', features: [obj as unknown as GeoJSONFeature] };
  }
  if (obj.type === 'FeatureCollection') {
    return obj as unknown as GeoJSONFeatureCollection;
  }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: obj as unknown as GeoJSONGeometry, properties: null }],
  };
}

type Pos = [number, number, ...number[]];

function flatCoords(geom: GeoJSONGeometry | null): Pos[] {
  if (!geom) return [];
  const c = geom.coordinates as unknown;
  switch (geom.type) {
    case 'Point': return [c as Pos];
    case 'MultiPoint':
    case 'LineString': return c as Pos[];
    case 'MultiLineString':
    case 'Polygon': return (c as Pos[][]).flat();
    case 'MultiPolygon': return (c as Pos[][][]).flat(2);
    default: return [];
  }
}

/** Compute [minLon, minLat, maxLon, maxLat] in WGS-84. Returns null if no coordinates. */
export function geojsonBbox(fc: GeoJSONFeatureCollection): [number, number, number, number] | null {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const f of fc.features) {
    for (const [lon, lat] of flatCoords(f.geometry)) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!isFinite(minLon)) return null;
  return [minLon, minLat, maxLon, maxLat];
}

export interface GeoJSONSummary {
  count: number;
  types: string[];
  propKeys: string[];
}

/** Summarise a FeatureCollection for the inspector UI. */
export function geojsonSummary(fc: GeoJSONFeatureCollection): GeoJSONSummary {
  const types = [...new Set(fc.features.map((f) => f.geometry?.type ?? 'Unknown'))];
  const propKeys = [...new Set(fc.features.flatMap((f) => Object.keys(f.properties ?? {})))].slice(0, 30);
  return { count: fc.features.length, types, propKeys };
}

/** Attribute fields of a FeatureCollection + whether each is numeric (for the field selector). */
export function geojsonFields(fc: GeoJSONFeatureCollection): { name: string; numeric: boolean }[] {
  const keys = [...new Set(fc.features.flatMap((f) => Object.keys(f.properties ?? {})))].slice(0, 30);
  return keys.map((name) => {
    const vals = fc.features.map((f) => f.properties?.[name]).filter((v) => v !== undefined && v !== null);
    const numeric = vals.length > 0 && vals.every((v) => typeof v === 'number' && Number.isFinite(v));
    return { name, numeric };
  });
}
