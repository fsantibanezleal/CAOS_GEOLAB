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
  data_kind?: string; // raster | vector | lidar | table | number | string | bool | file | json | text | field
  io_role?: 'input' | 'output';
  required?: boolean;
  description?: string;
  schema?: GeolibreSchema;
  /** For an attribute-field param (data_kind 'field'): the sibling vector-layer param it draws fields from. */
  field_from?: string;
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
    case 'field':
      return { type: 'field', label, fromLayerParam: p.field_from ?? 'input', default: typeof def === 'string' ? def : undefined, optional };
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

// ───────────────────────── D1/D2: fill empty manifests + reclassify string-file inputs ─────────────────────────
// geolibre-wasm@0.4.4 ships 138/747 tools with EMPTY params (blank forms; runs fail "missing required
// parameter 'input'"). We fill them from the authoritative WhiteboxTools metadata (whitebox-params.json,
// baked offline in data-pipeline/whitebox/). geolibre RENAMED flags vs standard WBT (it uses --input not
// --dem, --target_size not --size), so we do NOT use WBT's flags — we synthesize geolibre-native names
// (--input/--output + the manifest's own `defaults` keys) and use WBT only for the input KIND, enum OPTIONS
// and param TYPES (which don't drift). See wip/geolab/remediation/01-whitebox-params-and-docs.md.
import WBT from './whitebox-params.json';

interface WbtParam {
  name?: string;
  flags?: string[];
  description?: string;
  parameter_type?: unknown;
  default_value?: string | null;
  optional?: boolean;
}
interface WbtTool {
  tool: string;
  description: string;
  toolbox: string;
  parameters: WbtParam[];
}
const WBT_TOOLS = (WBT as { tools: Record<string, WbtTool> }).tools;

const FILE_EXT = /\.(tif|tiff|geojson|json|shp|fgb|gpkg|las|laz|zlidar|csv|dem|pmtiles|dat)$/i;
const IO_NAMES = new Set([
  'input', 'inputs', 'i', 'dem', 'pntr', 'pointer', 'streams', 'pour_pts', 'base', 'points',
  'polygons', 'lines', 'raster', 'vector', 'lidar', 'fdir', 'flow_dir', 'd8_pntr',
]);

function extKind(name: string): 'raster' | 'vector' | 'lidar' | 'table' | undefined {
  if (/\.(tif|tiff|dem|png)$/i.test(name)) return 'raster';
  if (/\.(geojson|json|shp|fgb|gpkg|pmtiles)$/i.test(name)) return 'vector';
  if (/\.(las|laz|zlidar)$/i.test(name)) return 'lidar';
  if (/\.csv$/i.test(name)) return 'table';
  return undefined;
}
function categoryInputKind(category?: string): 'raster' | 'vector' | 'lidar' {
  const c = (category ?? '').toLowerCase();
  if (c.includes('vector')) return 'vector';
  if (c.includes('lidar')) return 'lidar';
  return 'raster';
}
function wbtFileInner(pt: unknown): unknown {
  if (pt && typeof pt === 'object') {
    const o = pt as Record<string, unknown>;
    for (const k of ['ExistingFile', 'ExistingFileOrFloat', 'FileList']) if (k in o) return o[k];
  }
  return undefined;
}
function wbtIsFileInput(p: WbtParam): boolean {
  return wbtFileInner(p.parameter_type) !== undefined;
}
function wbtKind(inner: unknown): 'raster' | 'vector' | 'lidar' | 'file' {
  if (inner === 'Raster') return 'raster';
  if (inner === 'Lidar') return 'lidar';
  if (inner && typeof inner === 'object' && ('Vector' in (inner as object) || 'RasterAndVector' in (inner as object))) return 'vector';
  return 'file';
}
function wbtEnumFor(key: string, wbt?: WbtTool): string[] | undefined {
  if (!wbt) return undefined;
  const k = key.toLowerCase().replace(/_/g, '');
  for (const p of wbt.parameters) {
    const pt = p.parameter_type as { OptionList?: unknown } | undefined;
    if (pt && Array.isArray(pt.OptionList)) {
      const flags = (p.flags ?? []).map((f) => f.replace(/^-+/, '').replace(/-/g, '').toLowerCase());
      if (flags.includes(k) || (p.name ?? '').toLowerCase().replace(/[^a-z]/g, '').includes(k)) {
        return pt.OptionList as string[];
      }
    }
  }
  return undefined;
}

/** Synthesize geolibre-native params for a tool whose manifest params are empty (the 138-tool fix). */
function synthesizeParams(m: GeolibreManifest): GeolibreParam[] {
  const wbt = WBT_TOOLS[m.id];
  const out: GeolibreParam[] = [];
  const fileInputs = wbt ? wbt.parameters.filter(wbtIsFileInput) : [];
  const multi = fileInputs.length >= 2 && fileInputs.every((f) => (f.flags ?? []).some((fl) => /input\d/i.test(fl)));
  if (multi) {
    fileInputs.forEach((f, i) =>
      out.push({ name: `input${i + 1}`, data_kind: wbtKind(wbtFileInner(f.parameter_type)), io_role: 'input', required: true, schema: { kind: 'input' } }),
    );
  } else {
    const k = fileInputs[0] ? wbtKind(wbtFileInner(fileInputs[0].parameter_type)) : categoryInputKind(m.category);
    out.push({ name: 'input', data_kind: k === 'file' ? 'raster' : k, io_role: 'input', required: true, schema: { kind: 'input' } });
  }
  const outKind = out[0]?.data_kind ?? 'raster';
  out.push({ name: 'output', data_kind: outKind, io_role: 'output', required: false, schema: { kind: 'output' } });
  for (const [key, val] of Object.entries(m.defaults ?? {})) {
    if (key === 'input' || key === 'output' || key.startsWith('input')) continue;
    const enumVals = wbtEnumFor(key, wbt);
    if (enumVals) {
      out.push({ name: key, data_kind: 'string', io_role: 'input', required: false, schema: { kind: 'enum', values: enumVals } });
    } else if (typeof val === 'boolean') {
      out.push({ name: key, data_kind: 'bool', io_role: 'input', required: false });
    } else if (typeof val === 'number') {
      out.push({ name: key, data_kind: 'number', io_role: 'input', required: false });
    } else if (typeof val === 'string' && FILE_EXT.test(val)) {
      out.push({ name: key, data_kind: extKind(val) ?? 'file', io_role: 'input', required: false });
    } else {
      out.push({ name: key, data_kind: 'string', io_role: 'input', required: false });
    }
  }
  return out;
}

/** Reclassify a data_kind:'string' input that is really a file (default looks like a path, or a known I/O name). */
function reclassifyStringFile(p: GeolibreParam, defaults: Record<string, unknown> | undefined, category?: string): GeolibreParam {
  if (p.data_kind !== 'string' || p.io_role === 'output') return p;
  const def = defaults?.[p.name];
  const looksFile = (typeof def === 'string' && FILE_EXT.test(def)) || IO_NAMES.has(p.name.toLowerCase());
  if (!looksFile) return p;
  const kind = (typeof def === 'string' ? extKind(def) : undefined) ?? categoryInputKind(category);
  return { ...p, data_kind: kind };
}

// D2 (field selector): geolibre encodes a vector attribute-field name as a plain `string` param (and a few
// are even mislabeled raster/lidar). The user can't know which column to type. We detect field params by
// name (`field`, `fieldx`, `field_name`, `*_field`, `*_fields`) and rewire them to a `field` widget that
// reads the columns of the vector layer the user picked in the sibling param. WBT confirms these are
// VectorAttributeField tied to `--input` (whitebox-params.json), but the names alone are sufficient + stable.
const FIELD_RE = /(^|_)fields?(_name)?$|^field[xy]$/i;
const VECTOR_PARAM_PRIORITY = ['input', 'points', 'base', 'streams', 'lines', 'polygons', 'vector', 'i'];

function isFieldName(name: string): boolean {
  return name.toLowerCase() !== 'field_type' && FIELD_RE.test(name);
}

/** The vector-layer param that an attribute-field param draws its columns from (by name priority, else first). */
function pickVectorParam(ps: GeolibreParam[]): string | undefined {
  const vectors = ps.filter((p) => p.io_role !== 'output' && p.data_kind === 'vector');
  if (!vectors.length) return undefined;
  for (const name of VECTOR_PARAM_PRIORITY) {
    const hit = vectors.find((p) => p.name.toLowerCase() === name);
    if (hit) return hit.name;
  }
  return vectors[0]!.name;
}

/** Rewire a field-named param to data_kind 'field' (unless its default is a real file path or there's no vector sibling). */
function reclassifyField(p: GeolibreParam, defaults: Record<string, unknown> | undefined, vectorParam: string | undefined): GeolibreParam {
  if (p.io_role === 'output' || !isFieldName(p.name) || !vectorParam) return p;
  const def = defaults?.[p.name];
  if (typeof def === 'string' && FILE_EXT.test(def)) return p; // a real file masquerading as a field name
  return { ...p, data_kind: 'field', field_from: vectorParam };
}

/** The params GeoLab actually uses: real manifest params (reclassified), or synthesized when the manifest is empty. */
function effectiveParams(m: GeolibreManifest): GeolibreParam[] {
  const base = m.params && m.params.length > 0
    ? m.params.map((p) => reclassifyStringFile(p, m.defaults, m.category))
    : synthesizeParams(m);
  const vectorParam = pickVectorParam(base);
  return base.map((p) => reclassifyField(p, m.defaults, vectorParam));
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
  // D1+D2: fill the 138 empty-manifest tools + reclassify string-file inputs. Mutate in place so run() and
  // collectRunArgs (which both iterate m.params) see the corrected set.
  m.params = effectiveParams(m);
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
