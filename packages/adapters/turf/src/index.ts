/**
 * Turf.js adapter — maps 16 MIT-licensed Turf.js v7 vector-analysis functions into GeoLab Tool objects.
 *
 * Every tool runs on the MAIN THREAD (pure-JS, no WASM). The `run()` method receives a ToolRunContext,
 * reads input bytes from the virtual FS, calls the Turf function, serialises the GeoJSON result, and
 * writes it back. No worker, no heavy init — just instant vector math.
 *
 * Tool IDs follow the pattern `turf:<function-name>` to avoid collisions with the geolibre namespace.
 */

import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon, GeoJSON as GeoJSONType } from 'geojson';
import { license, type Provenance, type Tool, type ToolRunContext, type ToolRunResult } from '@geolab/tool-core';

// ── shared provenance ──────────────────────────────────────────────────────────

const TURF_PROVENANCE: Provenance = {
  engine: 'turf',
  upstreamProject: 'Turf.js',
  authors: 'Turf.js contributors',
  license: license('MIT'),
  version: '7.3.5',
  url: 'https://turfjs.org/',
};

// ── helpers ────────────────────────────────────────────────────────────────────

/** Read bytes from a layer param → parse as GeoJSON FeatureCollection. */
async function readLayer(ctx: ToolRunContext, layerId: unknown): Promise<FeatureCollection> {
  if (typeof layerId !== 'string' || !layerId) throw new Error('Layer param must be a non-empty string id.');
  const layer = ctx.layer(layerId);
  if (!layer) throw new Error(`Layer not found: ${layerId}`);
  const bytes = await ctx.fs.read(layer.bytesRef);
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text) as GeoJSONType;
  if (parsed.type === 'FeatureCollection') return parsed as FeatureCollection;
  if (parsed.type === 'Feature') return turf.featureCollection([parsed as Feature]);
  return turf.featureCollection([turf.feature(parsed as Geometry)]);
}

function toBytes(geojson: GeoJSONType | object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(geojson));
}

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function vectorOutput(
  ctx: ToolRunContext,
  toolId: string,
  geojson: GeoJSONType | object,
): Promise<ToolRunResult> {
  const ref = `out/${toolId}/${Date.now()}.geojson`;
  const bytes = toBytes(geojson);
  await ctx.fs.write(ref, bytes);
  return {
    outputs: [{ name: 'output.geojson', kind: 'vector', bytesRef: ref, format: 'GeoJSON' }],
    log: [`turf:${toolId} → ${(bytes.length / 1024).toFixed(1)} KB GeoJSON`],
  };
}

async function textOutput(
  ctx: ToolRunContext,
  toolId: string,
  text: string,
): Promise<ToolRunResult> {
  const ref = `out/${toolId}/${Date.now()}.txt`;
  await ctx.fs.write(ref, textBytes(text));
  return {
    outputs: [{ name: 'result.txt', kind: 'text', bytesRef: ref }],
    log: [text],
  };
}

function polygonFeatures(fc: FeatureCollection): Feature<Polygon | MultiPolygon>[] {
  return fc.features.filter(
    (f): f is Feature<Polygon | MultiPolygon> =>
      f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
  );
}

// ── tool definitions ───────────────────────────────────────────────────────────

export function buildTurfTools(): Tool[] {
  return [
    // ── Measurement → text ──────────────────────────────────────────────

    {
      id: 'turf:area',
      name: 'Area',
      summary: 'Calculate the total area of polygon features (m² and km²).',
      category: 'spatial-statistics',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer (polygons)', accepts: ['vector'] },
        output: { type: 'output', label: 'Area report', kind: 'text' },
      },
      inputs: ['vector'],
      outputs: ['text'],
      provenance: TURF_PROVENANCE,
      tags: ['measurement', 'area', 'polygon'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const m2 = turf.area(fc);
        const km2 = m2 / 1e6;
        const text = `Area = ${m2.toLocaleString('en', { maximumFractionDigits: 2 })} m²  (${km2.toFixed(4)} km²)`;
        return textOutput(ctx, 'area', text);
      },
    },

    {
      id: 'turf:length',
      name: 'Length',
      summary: 'Calculate the total length of line features.',
      category: 'spatial-statistics',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer (lines)', accepts: ['vector'] },
        units: {
          type: 'enum',
          label: 'Units',
          options: [
            { value: 'kilometers', label: 'km' },
            { value: 'meters', label: 'm' },
            { value: 'miles', label: 'mi' },
          ],
          default: 'kilometers',
        },
        output: { type: 'output', label: 'Length report', kind: 'text' },
      },
      inputs: ['vector'],
      outputs: ['text'],
      provenance: TURF_PROVENANCE,
      tags: ['measurement', 'length', 'line'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const units = (params['units'] as turf.Units | undefined) ?? 'kilometers';
        const total = turf.length(fc, { units });
        const text = `Length = ${total.toFixed(4)} ${units}`;
        return textOutput(ctx, 'length', text);
      },
    },

    // ── Geometry derivation → vector ────────────────────────────────────

    {
      id: 'turf:centroid',
      name: 'Centroid',
      summary: 'Compute the geometric centroid (arithmetic mean of coordinates) of features.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        output: { type: 'output', label: 'Centroid point', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['centroid', 'point'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const c = turf.centroid(fc);
        return vectorOutput(ctx, 'centroid', turf.featureCollection([c]));
      },
    },

    {
      id: 'turf:center',
      name: 'Center',
      summary: 'Compute the center of the bounding box of a feature collection.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        output: { type: 'output', label: 'Center point', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['center', 'point', 'bbox'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const c = turf.center(fc);
        return vectorOutput(ctx, 'center', turf.featureCollection([c]));
      },
    },

    {
      id: 'turf:envelope',
      name: 'Envelope',
      summary: 'Create a bounding-box polygon around all features in a layer.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        output: { type: 'output', label: 'Envelope polygon', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['envelope', 'bbox', 'polygon'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const env = turf.envelope(fc);
        if (!env) throw new Error('Could not compute envelope — empty feature collection?');
        return vectorOutput(ctx, 'envelope', turf.featureCollection([env]));
      },
    },

    {
      id: 'turf:convex',
      name: 'Convex Hull',
      summary: 'Compute the convex hull polygon enclosing all features.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        output: { type: 'output', label: 'Convex hull polygon', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['convex-hull', 'polygon'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const hull = turf.convex(fc);
        if (!hull) throw new Error('Could not compute convex hull — fewer than 3 points?');
        return vectorOutput(ctx, 'convex', turf.featureCollection([hull]));
      },
    },

    {
      id: 'turf:point-on-feature',
      name: 'Point on Feature',
      summary: 'Find a point guaranteed to lie on the surface of the input feature collection.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        output: { type: 'output', label: 'Interior point', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['point', 'interior', 'polygon'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const pt = turf.pointOnFeature(fc);
        return vectorOutput(ctx, 'point-on-feature', turf.featureCollection([pt]));
      },
    },

    {
      id: 'turf:explode',
      name: 'Explode',
      summary: 'Extract all vertices of all input features as individual point features.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        output: { type: 'output', label: 'Vertex points', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['explode', 'vertices', 'points'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const pts = turf.explode(fc);
        return vectorOutput(ctx, 'explode', pts);
      },
    },

    {
      id: 'turf:flatten',
      name: 'Flatten',
      summary: 'Convert Multi* geometry types to their single-geometry equivalents.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer (any vector)', accepts: ['vector'] },
        output: { type: 'output', label: 'Flattened features', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['flatten', 'multi-geometry'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const flat = turf.flatten(fc);
        return vectorOutput(ctx, 'flatten', flat);
      },
    },

    // ── Transformation → vector ─────────────────────────────────────────

    {
      id: 'turf:buffer',
      name: 'Buffer',
      summary: 'Expand (or contract with negative distance) features by a fixed distance.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        distance: { type: 'number', label: 'Distance', default: 1, help: 'Positive = expand, negative = shrink.' },
        units: {
          type: 'enum',
          label: 'Units',
          options: [
            { value: 'kilometers', label: 'km' },
            { value: 'meters', label: 'm' },
            { value: 'miles', label: 'mi' },
            { value: 'degrees', label: 'degrees' },
          ],
          default: 'kilometers',
        },
        output: { type: 'output', label: 'Buffered features', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['buffer', 'expand', 'polygon'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const distance = typeof params['distance'] === 'number' ? params['distance'] : 1;
        const units = (params['units'] as turf.Units | undefined) ?? 'kilometers';
        const result = turf.buffer(fc, distance, { units });
        if (!result) throw new Error('Buffer produced no output.');
        return vectorOutput(ctx, 'buffer', result);
      },
    },

    {
      id: 'turf:simplify',
      name: 'Simplify',
      summary: 'Simplify geometries using the Ramer–Douglas–Peucker algorithm.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        tolerance: { type: 'number', label: 'Tolerance (degrees)', default: 0.01, min: 0.00001, help: 'Larger = more simplification.' },
        highQuality: { type: 'boolean', label: 'High quality', default: false, help: 'Slower but preserves topology better.' },
        output: { type: 'output', label: 'Simplified features', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['simplify', 'rdp', 'generalise'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const tolerance = typeof params['tolerance'] === 'number' ? params['tolerance'] : 0.01;
        const highQuality = Boolean(params['highQuality']);
        const result = turf.simplify(fc, { tolerance, highQuality });
        return vectorOutput(ctx, 'simplify', result);
      },
    },

    {
      id: 'turf:dissolve',
      name: 'Dissolve',
      summary: 'Merge adjacent polygons that share a common property value into a single polygon.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer (polygons)', accepts: ['vector'] },
        propertyName: { type: 'string', label: 'Group-by property name', optional: true, help: 'Leave blank to dissolve all polygons into one.' },
        output: { type: 'output', label: 'Dissolved polygons', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['dissolve', 'merge', 'polygon'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const propName = typeof params['propertyName'] === 'string' && params['propertyName'] ? params['propertyName'] : undefined;
        const polyFC = fc as unknown as FeatureCollection<Polygon>;
        const result = propName
          ? turf.dissolve(polyFC, { propertyName: propName })
          : turf.dissolve(polyFC);
        return vectorOutput(ctx, 'dissolve', result);
      },
    },

    {
      id: 'turf:transform-rotate',
      name: 'Rotate',
      summary: 'Rotate features by a given angle around their collective centroid.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        angle: { type: 'number', label: 'Angle (°, clockwise)', default: 45, min: -360, max: 360 },
        output: { type: 'output', label: 'Rotated features', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['rotate', 'transform'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const angle = typeof params['angle'] === 'number' ? params['angle'] : 45;
        const result = turf.transformRotate(fc, angle);
        return vectorOutput(ctx, 'transform-rotate', result);
      },
    },

    {
      id: 'turf:transform-scale',
      name: 'Scale',
      summary: 'Scale features relative to their collective centroid by a scale factor.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        factor: { type: 'number', label: 'Scale factor', default: 2, min: 0.01, help: '2 = double size, 0.5 = half size.' },
        output: { type: 'output', label: 'Scaled features', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['scale', 'transform'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const factor = typeof params['factor'] === 'number' ? params['factor'] : 2;
        const result = turf.transformScale(fc, factor);
        return vectorOutput(ctx, 'transform-scale', result);
      },
    },

    {
      id: 'turf:transform-translate',
      name: 'Translate',
      summary: 'Move features by a given distance in a given direction.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer', accepts: ['vector'] },
        distance: { type: 'number', label: 'Distance (km)', default: 10, min: 0 },
        direction: { type: 'number', label: 'Direction (° from N, clockwise)', default: 90, min: 0, max: 360 },
        output: { type: 'output', label: 'Translated features', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['translate', 'move', 'transform'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const distance = typeof params['distance'] === 'number' ? params['distance'] : 10;
        const direction = typeof params['direction'] === 'number' ? params['direction'] : 90;
        const result = turf.transformTranslate(fc, distance, direction);
        return vectorOutput(ctx, 'transform-translate', result);
      },
    },

    // ── Set operations → vector ─────────────────────────────────────────

    {
      id: 'turf:union',
      name: 'Union',
      summary: 'Merge all polygons in a layer into a single polygon (union of the whole layer).',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layer: { type: 'layer', label: 'Input layer (polygons)', accepts: ['vector'] },
        output: { type: 'output', label: 'Union polygon', kind: 'vector' },
      },
      inputs: ['vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['union', 'merge', 'polygon', 'set-operation'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fc = await readLayer(ctx, params['layer']);
        const polys = polygonFeatures(fc);
        if (polys.length === 0) throw new Error('No polygon features found in layer.');
        const result = turf.union(turf.featureCollection(polys));
        if (!result) throw new Error('Union produced no output.');
        return vectorOutput(ctx, 'union', turf.featureCollection([result]));
      },
    },

    {
      id: 'turf:intersect',
      name: 'Intersect (A ∩ B)',
      summary: 'Compute the geometric intersection of each feature in layer A with all features in layer B.',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layerA: { type: 'layer', label: 'Layer A (polygon)', accepts: ['vector'] },
        layerB: { type: 'layer', label: 'Layer B (polygon)', accepts: ['vector'] },
        output: { type: 'output', label: 'Intersection features', kind: 'vector' },
      },
      inputs: ['vector', 'vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['intersect', 'intersection', 'polygon', 'set-operation'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fcA = await readLayer(ctx, params['layerA']);
        const fcB = await readLayer(ctx, params['layerB']);
        const results: Feature[] = [];
        for (const fA of polygonFeatures(fcA)) {
          for (const fB of polygonFeatures(fcB)) {
            const inter = turf.intersect(turf.featureCollection([fA, fB]));
            if (inter) results.push(inter);
          }
        }
        if (results.length === 0) throw new Error('No overlapping areas found between A and B.');
        return vectorOutput(ctx, 'intersect', turf.featureCollection(results));
      },
    },

    {
      id: 'turf:difference',
      name: 'Difference (A − B)',
      summary: 'Subtract the geometry of layer B from layer A (A minus B).',
      category: 'vector-gis',
      version: '7.3.5',
      params: {
        layerA: { type: 'layer', label: 'Layer A (polygon)', accepts: ['vector'] },
        layerB: { type: 'layer', label: 'Layer B (to subtract)', accepts: ['vector'] },
        output: { type: 'output', label: 'Difference features', kind: 'vector' },
      },
      inputs: ['vector', 'vector'],
      outputs: ['vector'],
      provenance: TURF_PROVENANCE,
      tags: ['difference', 'subtract', 'polygon', 'set-operation'],
      async run(ctx: ToolRunContext, params: Record<string, unknown>): Promise<ToolRunResult> {
        const fcA = await readLayer(ctx, params['layerA']);
        const fcB = await readLayer(ctx, params['layerB']);
        const results: Feature[] = [];
        for (const fA of polygonFeatures(fcA)) {
          for (const fB of polygonFeatures(fcB)) {
            const diff = turf.difference(turf.featureCollection([fA, fB]));
            if (diff) results.push(diff);
          }
        }
        if (results.length === 0) throw new Error('Difference produced no output — B may fully cover A.');
        return vectorOutput(ctx, 'difference', turf.featureCollection(results));
      },
    },
  ];
}
