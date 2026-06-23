/**
 * H3 adapter — maps 8 Uber H3 (h3-js v4) hexagonal-grid functions into GeoLab Tool objects.
 *
 * All tools run on the MAIN THREAD (pure-JS, no WASM). H3 cell IDs are hexadecimal strings;
 * the tools surface them as GeoJSON feature properties so downstream tools can chain on them.
 *
 * Tool IDs follow the pattern `h3:<operation>` to avoid collisions with other engine namespaces.
 * Output GeoJSON features carry `properties.h3index` (the H3 cell ID) for compact/uncompact chaining.
 */

import {
  latLngToCell,
  cellToBoundary,
  gridDisk,
  polygonToCells,
  compactCells,
  uncompactCells,
  gridPathCells,
  greatCircleDistance,
  cellArea,
  cellToParent,
  getResolution,
  getHexagonAreaAvg,
} from 'h3-js';
import type { Feature, FeatureCollection, Polygon, Point } from 'geojson';
import { license, type Provenance, type Tool, type ToolRunContext, type ToolRunResult } from '@geolab/tool-core';

// ── shared provenance ──────────────────────────────────────────────────────────

const H3_PROVENANCE: Provenance = {
  engine: 'h3',
  upstreamProject: 'Uber H3 (h3-js)',
  authors: 'Uber Technologies, Inc.',
  license: license('Apache-2.0'),
  version: '4.4.0',
  url: 'https://h3geo.org/',
};

// ── type aliases ───────────────────────────────────────────────────────────────

type H3Index = string;
type CoordPair = [number, number];

// ── helpers ────────────────────────────────────────────────────────────────────

async function readLayer(ctx: ToolRunContext, layerId: unknown): Promise<FeatureCollection> {
  if (typeof layerId !== 'string' || !layerId) throw new Error('Layer param must be a non-empty string id.');
  const layer = ctx.layer(layerId);
  if (!layer) throw new Error(`Layer not found: ${layerId}`);
  const bytes = await ctx.fs.read(layer.bytesRef);
  return JSON.parse(new TextDecoder().decode(bytes)) as FeatureCollection;
}

function toBytes(obj: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Build a GeoJSON Polygon Feature from an H3 cell boundary (using GeoJSON [lng,lat] order). */
function cellToPolygon(cell: H3Index): Feature<Polygon> {
  const boundary = cellToBoundary(cell, true) as CoordPair[]; // GeoJSON [lng, lat]
  return {
    type: 'Feature',
    properties: { h3index: cell, h3res: getResolution(cell) },
    geometry: {
      type: 'Polygon',
      coordinates: [[...boundary, boundary[0] as CoordPair]],
    },
  };
}

/** Convert an array of H3 cell IDs to a GeoJSON FeatureCollection of polygons. */
function cellsToFC(cells: H3Index[]): FeatureCollection {
  return { type: 'FeatureCollection', features: cells.map(cellToPolygon) };
}

/** Extract the first Point from a FeatureCollection; returns [lat, lng] for H3 (H3 convention). */
function firstPointLatLng(fc: FeatureCollection): [number, number] {
  for (const f of fc.features) {
    if (!f.geometry) continue;
    if (f.geometry.type === 'Point') {
      const [lng, lat] = f.geometry.coordinates as [number, number];
      return [lat, lng];
    }
    if (f.geometry.type === 'MultiPoint' && f.geometry.coordinates.length > 0) {
      const [lng, lat] = f.geometry.coordinates[0] as [number, number];
      return [lat, lng];
    }
  }
  throw new Error('No Point feature found in layer — upload a GeoJSON with Point geometry.');
}

/** Extract H3 cell IDs from the h3index property of each feature in a FeatureCollection. */
function extractCellIds(fc: FeatureCollection): H3Index[] {
  const ids: H3Index[] = [];
  for (const f of fc.features) {
    const id = f.properties?.['h3index'] as string | undefined;
    if (id) ids.push(id);
  }
  if (ids.length === 0) throw new Error('No h3index property found on features. Run h3:polyfill or h3:k-ring first.');
  return ids;
}

async function vectorOutput(ctx: ToolRunContext, toolId: string, fc: FeatureCollection): Promise<ToolRunResult> {
  const ref = `out/${toolId}/${Date.now()}.geojson`;
  const bytes = toBytes(fc);
  await ctx.fs.write(ref, bytes);
  return {
    outputs: [{ name: 'output.geojson', kind: 'vector', bytesRef: ref, format: 'GeoJSON' }],
    log: [`h3:${toolId} → ${fc.features.length} features (${(bytes.length / 1024).toFixed(1)} KB)`],
  };
}

async function textOutput(ctx: ToolRunContext, toolId: string, text: string): Promise<ToolRunResult> {
  const ref = `out/${toolId}/${Date.now()}.txt`;
  await ctx.fs.write(ref, textBytes(text));
  return {
    outputs: [{ name: 'result.txt', kind: 'text', bytesRef: ref }],
    log: [text],
  };
}

// ── tool definitions ───────────────────────────────────────────────────────────

export function buildH3Tools(): Tool[] {
  return [

    // ─── 1. Point → cell polygon ───────────────────────────────────────────

    {
      id: 'h3:point-to-cell',
      name: 'Point to H3 Cell',
      summary: 'Find the H3 hexagonal cell that contains the first Point in a layer and return it as a polygon.',
      category: 'vector-gis',
      version: '4.4.0',
      params: {
        layer: { type: 'layer', label: 'Input layer (Point)', accepts: ['vector'] },
        resolution: { type: 'integer', label: 'H3 resolution (0–15)', default: 7, min: 0, max: 15 },
        output: { type: 'output', label: 'H3 cell polygon', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: H3_PROVENANCE,
      tags: ['h3', 'hexagon', 'cell', 'point'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const res = typeof params['resolution'] === 'number' ? Math.round(params['resolution']) : 7;
        const [lat, lng] = firstPointLatLng(fc);
        const cellId = latLngToCell(lat, lng, res);
        return vectorOutput(ctx, 'point-to-cell', { type: 'FeatureCollection', features: [cellToPolygon(cellId)] });
      },
    },

    // ─── 2. Polygon → polyfill (H3 cells) ────────────────────────────────

    {
      id: 'h3:polyfill',
      name: 'Polyfill Polygon',
      summary: 'Fill a polygon with H3 hexagonal cells at a given resolution (compact coverage).',
      category: 'vector-gis',
      version: '4.4.0',
      params: {
        layer: { type: 'layer', label: 'Input layer (Polygon)', accepts: ['vector'] },
        resolution: { type: 'integer', label: 'H3 resolution (0–15)', default: 5, min: 0, max: 12 },
        output: { type: 'output', label: 'H3 cells (polygons with h3index)', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: H3_PROVENANCE,
      tags: ['h3', 'hexagon', 'polyfill', 'polygon', 'coverage'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const res = typeof params['resolution'] === 'number' ? Math.round(params['resolution']) : 5;

        const polyFeature = fc.features.find(
          (f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
        );
        if (!polyFeature || !polyFeature.geometry) {
          throw new Error('No Polygon feature found in layer. Upload a GeoJSON with Polygon geometry.');
        }

        let cells: H3Index[] = [];
        if (polyFeature.geometry.type === 'Polygon') {
          cells = polygonToCells(polyFeature.geometry.coordinates as number[][][], res, true);
        } else {
          // MultiPolygon: union cells from all sub-polygons
          const seen = new Set<string>();
          for (const ring of (polyFeature.geometry as { type: 'MultiPolygon'; coordinates: number[][][][] }).coordinates) {
            const sub = polygonToCells(ring as number[][][], res, true);
            for (const c of sub) if (!seen.has(c)) { seen.add(c); cells.push(c); }
          }
        }

        if (cells.length === 0) throw new Error('No H3 cells found — try a lower resolution or a larger polygon.');
        if (cells.length > 50_000) throw new Error(`Too many cells at res ${res}: ${cells.length}. Lower the resolution.`);

        return vectorOutput(ctx, 'polyfill', cellsToFC(cells));
      },
    },

    // ─── 3. Point → k-ring disk ───────────────────────────────────────────

    {
      id: 'h3:k-ring',
      name: 'Grid Disk (k-Ring)',
      summary: 'Return all H3 cells within k hops of the cell containing a point (hexagonal neighbourhood).',
      category: 'vector-gis',
      version: '4.4.0',
      params: {
        layer: { type: 'layer', label: 'Input layer (Point)', accepts: ['vector'] },
        resolution: { type: 'integer', label: 'H3 resolution (0–15)', default: 7, min: 0, max: 15 },
        k: { type: 'integer', label: 'Ring size k (hops)', default: 2, min: 0, max: 20 },
        output: { type: 'output', label: 'Grid disk cells', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: H3_PROVENANCE,
      tags: ['h3', 'hexagon', 'k-ring', 'disk', 'neighborhood'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const res = typeof params['resolution'] === 'number' ? Math.round(params['resolution']) : 7;
        const k = typeof params['k'] === 'number' ? Math.round(params['k']) : 2;
        const [lat, lng] = firstPointLatLng(fc);
        const origin = latLngToCell(lat, lng, res);
        const disk = gridDisk(origin, k);
        return vectorOutput(ctx, 'k-ring', cellsToFC(disk));
      },
    },

    // ─── 4. Compact cells ────────────────────────────────────────────────

    {
      id: 'h3:compact',
      name: 'Compact H3 Cells',
      summary: 'Compactly represent a set of H3 cells using mixed resolutions (removes redundant cells covered by coarser parents).',
      category: 'vector-gis',
      version: '4.4.0',
      params: {
        layer: { type: 'layer', label: 'H3 cells layer (from Polyfill/k-Ring)', accepts: ['vector'] },
        output: { type: 'output', label: 'Compacted H3 cells', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: H3_PROVENANCE,
      tags: ['h3', 'hexagon', 'compact', 'simplify'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const ids = extractCellIds(fc);
        const compacted = compactCells(ids);
        return vectorOutput(ctx, 'compact', cellsToFC(compacted));
      },
    },

    // ─── 5. Uncompact cells ───────────────────────────────────────────────

    {
      id: 'h3:uncompact',
      name: 'Uncompact H3 Cells',
      summary: 'Expand compacted H3 cells to a uniform target resolution (inverse of compact).',
      category: 'vector-gis',
      version: '4.4.0',
      params: {
        layer: { type: 'layer', label: 'H3 cells layer (from Compact)', accepts: ['vector'] },
        resolution: { type: 'integer', label: 'Target resolution (0–15)', default: 7, min: 0, max: 15 },
        output: { type: 'output', label: 'Uncompacted H3 cells', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: H3_PROVENANCE,
      tags: ['h3', 'hexagon', 'uncompact', 'expand'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const res = typeof params['resolution'] === 'number' ? Math.round(params['resolution']) : 7;
        const ids = extractCellIds(fc);
        const expanded = uncompactCells(ids, res);
        if (expanded.length > 50_000) throw new Error(`Uncompact at res ${res} produced ${expanded.length} cells — choose a lower resolution.`);
        return vectorOutput(ctx, 'uncompact', cellsToFC(expanded));
      },
    },

    // ─── 6. Grid path between two points ──────────────────────────────────

    {
      id: 'h3:grid-path',
      name: 'Grid Path',
      summary: 'Return the ordered sequence of H3 cells forming the shortest grid path between two points.',
      category: 'vector-gis',
      version: '4.4.0',
      params: {
        layerA: { type: 'layer', label: 'Layer A — origin point', accepts: ['vector'] },
        layerB: { type: 'layer', label: 'Layer B — destination point', accepts: ['vector'] },
        resolution: { type: 'integer', label: 'H3 resolution (0–15)', default: 7, min: 0, max: 15 },
        output: { type: 'output', label: 'Path cells', kind: 'vector' },
      },
      inputs: ['vector', 'vector'],
      outputs: ['vector'],
      provenance: H3_PROVENANCE,
      tags: ['h3', 'hexagon', 'path', 'routing'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fcA = await readLayer(ctx, params['layerA']);
        const fcB = await readLayer(ctx, params['layerB']);
        const res = typeof params['resolution'] === 'number' ? Math.round(params['resolution']) : 7;
        const [latA, lngA] = firstPointLatLng(fcA);
        const [latB, lngB] = firstPointLatLng(fcB);
        const origin = latLngToCell(latA, lngA, res);
        const dest = latLngToCell(latB, lngB, res);
        const path = gridPathCells(origin, dest);
        return vectorOutput(ctx, 'grid-path', cellsToFC(path));
      },
    },

    // ─── 7. Great-circle distance ─────────────────────────────────────────

    {
      id: 'h3:great-circle-distance',
      name: 'Great-Circle Distance',
      summary: 'Compute the geodesic (great-circle) distance between the first Points of two layers.',
      category: 'spatial-statistics',
      version: '4.4.0',
      params: {
        layerA: { type: 'layer', label: 'Layer A — origin point', accepts: ['vector'] },
        layerB: { type: 'layer', label: 'Layer B — destination point', accepts: ['vector'] },
        units: {
          type: 'enum',
          label: 'Units',
          options: [
            { value: 'km', label: 'km' },
            { value: 'm', label: 'm' },
            { value: 'rads', label: 'radians' },
          ],
          default: 'km',
        },
        output: { type: 'output', label: 'Distance report', kind: 'text' },
      },
      inputs: ['vector', 'vector'],
      outputs: ['text'],
      provenance: H3_PROVENANCE,
      tags: ['h3', 'distance', 'geodesic', 'great-circle'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fcA = await readLayer(ctx, params['layerA']);
        const fcB = await readLayer(ctx, params['layerB']);
        const units = typeof params['units'] === 'string' ? params['units'] : 'km';
        const [latA, lngA] = firstPointLatLng(fcA);
        const [latB, lngB] = firstPointLatLng(fcB);
        const dist = greatCircleDistance([latA, lngA], [latB, lngB], units);
        const text = `Great-circle distance = ${dist.toFixed(4)} ${units}\n(from [${lngA.toFixed(5)}, ${latA.toFixed(5)}] to [${lngB.toFixed(5)}, ${latB.toFixed(5)}])`;
        return textOutput(ctx, 'great-circle-distance', text);
      },
    },

    // ─── 8. Cell info report ──────────────────────────────────────────────

    {
      id: 'h3:cell-info',
      name: 'Cell Info',
      summary: 'Report the H3 cell ID, resolution, area, and parent cell for the first Point in a layer.',
      category: 'spatial-statistics',
      version: '4.4.0',
      params: {
        layer: { type: 'layer', label: 'Input layer (Point)', accepts: ['vector'] },
        resolution: { type: 'integer', label: 'H3 resolution (0–15)', default: 7, min: 0, max: 15 },
        output: { type: 'output', label: 'Cell info report', kind: 'text' },
      },
      inputs: ['vector'],
      outputs: ['text'],
      provenance: H3_PROVENANCE,
      tags: ['h3', 'hexagon', 'info', 'report'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const res = typeof params['resolution'] === 'number' ? Math.round(params['resolution']) : 7;
        const [lat, lng] = firstPointLatLng(fc);
        const cell = latLngToCell(lat, lng, res);
        const area_km2 = cellArea(cell, 'km2');
        const area_m2 = cellArea(cell, 'm2');
        const avg_km2 = getHexagonAreaAvg(res, 'km2');
        const parent = res > 0 ? cellToParent(cell, res - 1) : 'none (root resolution)';

        const lines = [
          `H3 Cell Info`,
          `────────────────────────────────────`,
          `Point:       [lng=${lng.toFixed(6)}, lat=${lat.toFixed(6)}]`,
          `Cell ID:     ${cell}`,
          `Resolution:  ${res}`,
          `Cell area:   ${area_m2.toLocaleString('en', { maximumFractionDigits: 1 })} m²  ≈ ${area_km2.toFixed(6)} km²`,
          `Avg area:    ${avg_km2.toFixed(6)} km² (typical for res ${res})`,
          `Parent cell: ${parent}`,
        ];
        return textOutput(ctx, 'cell-info', lines.join('\n'));
      },
    },

  ];
}
