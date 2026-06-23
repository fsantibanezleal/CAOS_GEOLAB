/**
 * geolibre-wasm adapter — maps the **747** real WhiteboxTools+GeoLibre tools into GeoLab `Tool`s, with
 * provenance. Written against the REAL `geolibre-wasm@0.4.4` API (verified by probing the package):
 *
 *   import * as engine from "geolibre-wasm/tools";
 *   const manifests = await engine.listManifests();      // [{ id, display_name, summary, category,
 *                                                        //    source, license_tier, defaults, params:[
 *                                                        //      { name, data_kind, io_role, required, schema }]}]
 *   registry.registerAll(buildGeolibreTools(manifests, engine));
 *
 * The engine is injected (the app lazily `import()`s `geolibre-wasm/tools`), so the engine stays swappable
 * and the ~22 MB of WASM is loaded only when geolibre tools are used.
 */
import {
  license,
  type ParamSchema,
  type ParamSpec,
  type PortKind,
  type Provenance,
  type Tool,
  type ToolCategory,
  type ToolOutput,
  type ToolRunContext,
  type ToolRunResult,
} from '@geolab/tool-core';

// ───────────────────────── the real geolibre-wasm/tools surface ─────────────────────────

export interface GeolibreToolResult {
  exitCode: number;
  stdout: string[];
  files: Record<string, Uint8Array>;
}
export interface GeolibreToolsModule {
  initTools(source?: unknown): Promise<unknown>;
  listTools(): Promise<string[]>;
  listManifests(): Promise<GeolibreManifest[]>;
  runTool(
    tool: string,
    opts?: { args?: string[]; input?: Record<string, Uint8Array | ArrayBuffer | string> },
  ): Promise<GeolibreToolResult>;
}

export interface GeolibreSchema {
  kind?: string; // input | output | string | bool | scalar | enum | ...
  dataset?: { kind?: string };
  mode?: string;
  cardinality?: string;
  values?: unknown[];
  options?: unknown[];
}
export interface GeolibreParam {
  name: string;
  data_kind?: string; // raster | vector | lidar | table | number | string | bool | file | json | text
  io_role?: 'input' | 'output';
  required?: boolean;
  description?: string;
  schema?: GeolibreSchema;
}
export interface GeolibreManifest {
  id: string;
  display_name?: string;
  summary?: string;
  category?: string; // Conversion | Hydrology | Lidar | Other | Raster | Terrain | Vector
  source?: string; // whitebox | geolibre
  license_tier?: string;
  tags?: string[];
  defaults?: Record<string, unknown>;
  params: GeolibreParam[];
}

// ───────────────────────── mapping helpers ─────────────────────────

const CATEGORY_MAP: Record<string, ToolCategory> = {
  Raster: 'raster-math-stats',
  Terrain: 'terrain-morphometry',
  Hydrology: 'hydrology',
  Lidar: 'lidar-pointcloud',
  Vector: 'vector-gis',
  Conversion: 'data-io',
  Other: 'data-io',
};

function portOf(dataKind?: string): PortKind {
  switch (dataKind) {
    case 'raster':
      return 'raster';
    case 'vector':
      return 'vector';
    case 'lidar':
      return 'pointcloud';
    case 'table':
      return 'table';
    case 'number':
    case 'bool':
      return 'scalar';
    default:
      return 'text';
  }
}

function extOf(dataKind?: string): string {
  switch (dataKind) {
    case 'vector':
      return '.geojson';
    case 'lidar':
      return '.las';
    default:
      return '.tif';
  }
}

function enumOptions(schema?: GeolibreSchema): Array<{ value: string; label: string }> | undefined {
  const raw = schema?.values ?? schema?.options;
  if (!raw || !raw.length) return undefined;
  return raw.map((v) => ({ value: String(v), label: String(v) }));
}

function mapParam(p: GeolibreParam, defaults?: Record<string, unknown>): ParamSpec {
  const label = p.name;
  const def = defaults?.[p.name];
  if (p.io_role === 'output') {
    return { type: 'output', label, kind: portOf(p.data_kind), defaultName: typeof def === 'string' ? def : `${p.name}.tif` };
  }
  const optional = !p.required;
  const opts = enumOptions(p.schema);
  switch (p.data_kind) {
    case 'raster':
      return { type: 'layer', label, accepts: ['raster'], optional };
    case 'vector':
      return { type: 'layer', label, accepts: ['vector'], optional };
    case 'lidar':
      return { type: 'layer', label, accepts: ['pointcloud'], optional };
    case 'bool':
      return { type: 'boolean', label, default: typeof def === 'boolean' ? def : false };
    case 'number':
      if (opts) return { type: 'enum', label, options: opts, default: def != null ? String(def) : undefined };
      return { type: 'number', label, default: typeof def === 'number' ? def : undefined, optional };
    case 'string':
      if (opts) return { type: 'enum', label, options: opts, default: def != null ? String(def) : undefined };
      return { type: 'string', label, default: typeof def === 'string' ? def : undefined, optional };
    case 'file':
    case 'json':
    case 'text':
    case 'table':
      return { type: 'file', label };
    default:
      return { type: 'string', label, optional };
  }
}

function provenanceFor(source: string | undefined, version: string): Provenance {
  if (source === 'geolibre') {
    return {
      engine: 'geolibre',
      upstreamProject: 'GeoLibre tools (geolibre-rust)',
      authors: 'opengeos (Qiusheng Wu)',
      license: license('MIT'),
      version,
      url: 'https://github.com/opengeos/geolibre-rust',
    };
  }
  return {
    engine: 'geolibre',
    upstreamProject: 'WhiteboxTools / whitebox_next_gen (via geolibre-wasm)',
    authors: 'John Lindsay; opengeos (Qiusheng Wu)',
    license: license('MIT'),
    version,
    url: 'https://github.com/opengeos/geolibre-rust',
  };
}

// ───────────────────────── worker-runner helpers ─────────────────────────

/** Guess the PortKind of an output file from its extension. */
export function guessOutputKind(name: string): PortKind {
  if (/\.(tif|tiff|png)$/i.test(name)) return 'raster';
  if (/\.(geojson|json|shp|fgb|gpkg)$/i.test(name)) return 'vector';
  if (/\.(las|laz)$/i.test(name)) return 'pointcloud';
  if (/\.(csv|html)$/i.test(name)) return 'table';
  return 'text';
}

/** Detect a FileValue written by the ParamForm FileWidget ({name, bytes}). */
function isFileValue(v: unknown): v is { name: string; bytes: Uint8Array } {
  return typeof v === 'object' && v !== null && 'name' in v && 'bytes' in v && (v as { bytes: unknown }).bytes instanceof Uint8Array;
}

/**
 * Build the CLI args + input-file bytes for a geolibre tool run, from the manifest, user-supplied
 * values, and the workspace layers/FS. Called on the main thread before handing off to the Web Worker.
 */
export async function collectRunArgs(
  manifest: GeolibreManifest,
  values: Record<string, unknown>,
  getLayer: (id: string) => { id: string; bytesRef: string } | undefined,
  readBytes: (ref: string) => Promise<Uint8Array>,
): Promise<{ args: string[]; input: Record<string, Uint8Array> }> {
  const args: string[] = [];
  const input: Record<string, Uint8Array> = {};

  for (const p of manifest.params) {
    const v = values[p.name];
    if (p.io_role === 'output') {
      const def = manifest.defaults?.[p.name];
      const outName =
        typeof v === 'string' && v ? v : typeof def === 'string' ? def : `${manifest.id}_${p.name}${extOf(p.data_kind)}`;
      args.push(`--${p.name}=/work/${outName}`);
    } else if (['raster', 'vector', 'lidar'].includes(p.data_kind ?? '')) {
      if (typeof v === 'string') {
        const layer = getLayer(v);
        if (layer) {
          const fname = `${p.name}_${layer.id}${extOf(p.data_kind)}`;
          input[fname] = await readBytes(layer.bytesRef);
          args.push(`--${p.name}=/work/${fname}`);
        }
      }
    } else if (isFileValue(v)) {
      // User-picked file from the ParamForm FileWidget.
      input[v.name] = v.bytes;
      args.push(`--${p.name}=/work/${v.name}`);
    } else if (Array.isArray(v)) {
      // Extent / bbox: [minX, minY, maxX, maxY] → comma-separated.
      args.push(`--${p.name}=${v.join(',')}`);
    } else if (v !== undefined && v !== null && v !== '') {
      args.push(`--${p.name}=${String(v)}`);
    }
  }

  return { args, input };
}

// ───────────────────────── the builder ─────────────────────────

/** Build all GeoLab Tools from geolibre manifests + the engine module (for run()). */
export function buildGeolibreTools(
  manifests: GeolibreManifest[],
  engine: GeolibreToolsModule,
  version = '0.4.4',
): Tool[] {
  return manifests.map((m) => buildOne(m, engine, version));
}

function buildOne(m: GeolibreManifest, engine: GeolibreToolsModule, version: string): Tool {
  const params: ParamSchema = {};
  for (const p of m.params) params[p.name] = mapParam(p, m.defaults);

  const inputs: PortKind[] = m.params
    .filter((p) => p.io_role === 'input' && ['raster', 'vector', 'lidar', 'table'].includes(p.data_kind ?? ''))
    .map((p) => portOf(p.data_kind));
  const outputs: PortKind[] = m.params.filter((p) => p.io_role === 'output').map((p) => portOf(p.data_kind));

  const tags = [m.source ?? 'whitebox', ...(m.category ? [`cat:${m.category}`] : []), ...(m.tags ?? [])];

  return {
    id: `geolibre:${m.id}`,
    name: m.display_name ?? m.id,
    summary: m.summary ?? m.id,
    category: CATEGORY_MAP[m.category ?? ''] ?? 'data-io',
    version,
    params,
    inputs,
    outputs,
    provenance: provenanceFor(m.source, version),
    tags,
    async run(ctx: ToolRunContext, values: Record<string, unknown>): Promise<ToolRunResult> {
      const args: string[] = [];
      const input: Record<string, Uint8Array> = {};

      for (const p of m.params) {
        const v = values[p.name];
        if (p.io_role === 'output') {
          const def = m.defaults?.[p.name];
          const outName = typeof v === 'string' && v ? v : typeof def === 'string' ? def : `${m.id}_${p.name}${extOf(p.data_kind)}`;
          args.push(`--${p.name}=/work/${outName}`);
        } else if (['raster', 'vector', 'lidar'].includes(p.data_kind ?? '')) {
          if (typeof v === 'string') {
            const layer = ctx.layer(v);
            if (layer) {
              const fname = `${p.name}_${layer.id}${extOf(p.data_kind)}`;
              input[fname] = await ctx.fs.read(layer.bytesRef);
              args.push(`--${p.name}=/work/${fname}`);
            }
          }
        } else if (v !== undefined && v !== null && v !== '') {
          args.push(`--${p.name}=${String(v)}`);
        }
      }

      ctx.onProgress(0.1, `running ${m.id}`);
      const res = await engine.runTool(m.id, { args, input });
      if (res.exitCode !== 0) {
        throw new Error(`geolibre "${m.id}" exited ${res.exitCode}: ${res.stdout.join(' ').slice(0, 400)}`);
      }

      ctx.onProgress(0.9, 'writing outputs');
      const out: ToolOutput[] = [];
      for (const [name, bytes] of Object.entries(res.files)) {
        const ref = `out/${m.id}/${name}`;
        await ctx.fs.write(ref, bytes);
        out.push({ name, kind: guessOutputKind(name), bytesRef: ref, format: /\.tif$/i.test(name) ? 'COG' : undefined });
      }
      ctx.onProgress(1, 'done');
      return { outputs: out, log: res.stdout };
    },
  };
}
