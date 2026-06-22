/**
 * geolibre-wasm adapter — maps the ~740 WhiteboxTools+GeoLibre tools into GeoLab `Tool`s, with provenance.
 *
 * The engine (`geolibre-wasm/tools`) is **injected at runtime** (not a static dependency) so the engine is
 * swappable and the core build stays light. The app does, lazily:
 *
 *   const engine = await import('geolibre-wasm/tools');   // { listTools, runTool }
 *   registry.registerAll(buildGeolibreTools(engine));
 *
 * NOTE: the manifest→ParamSchema mapping below is modelled on the documented geolibre param-schema types
 * (input_raster / output_raster / scalar_integer / bool / enum_values …, dossier 01). It must be validated
 * against the real `listTools()` output and refined when the engine is wired (tracked in the build manifest).
 */
import {
  ENGINES,
  type ParamSchema,
  type ParamSpec,
  type PortKind,
  type Tool,
  type ToolCategory,
  type ToolRunContext,
  type ToolRunResult,
} from '@geolab/tool-core';

/** The minimal surface GeoLab needs from `geolibre-wasm/tools` (matches its documented JS API). */
export interface GeolibreEngine {
  listTools(): GeolibreManifest[];
  runTool(
    id: string,
    opts: { args: string[]; input?: Record<string, Uint8Array | string> },
  ): Promise<{ files: Record<string, Uint8Array> }>;
}

export interface GeolibreParam {
  name: string;
  /** geolibre param type tag, e.g. "input_raster" | "output_raster" | "scalar_integer" | "bool" | "enum_values". */
  type: string;
  label?: string;
  default?: unknown;
  options?: string[];
  optional?: boolean;
}

export interface GeolibreManifest {
  id: string;
  name?: string;
  description?: string;
  /** geolibre/whitebox category label, e.g. "Terrain Analysis", "Hydrological Analysis". */
  category?: string;
  parameters: GeolibreParam[];
}

const CATEGORY_MAP: Record<string, ToolCategory> = {
  'Data Tools': 'data-io',
  'GIS Analysis': 'vector-gis',
  'Hydrological Analysis': 'hydrology',
  'Image Analysis': 'imagery-remote-sensing',
  'LiDAR Analysis': 'lidar-pointcloud',
  'Math and Stats Tools': 'raster-math-stats',
  'Stream Network Analysis': 'stream-network',
  'Terrain Analysis': 'terrain-morphometry',
};

function mapCategory(c?: string): ToolCategory {
  return (c && CATEGORY_MAP[c]) || 'data-io';
}

function mapParam(p: GeolibreParam): ParamSpec {
  const label = p.label ?? p.name;
  switch (p.type) {
    case 'input_raster':
      return { type: 'layer', label, accepts: ['raster'], optional: p.optional };
    case 'input_vector':
      return { type: 'layer', label, accepts: ['vector'], optional: p.optional };
    case 'output_raster':
      return { type: 'output', label, kind: 'raster', defaultName: `${p.name}.tif` };
    case 'output_vector':
      return { type: 'output', label, kind: 'vector', defaultName: `${p.name}.geojson` };
    case 'scalar_integer':
      return { type: 'integer', label, default: typeof p.default === 'number' ? p.default : undefined, optional: p.optional };
    case 'scalar_float':
    case 'scalar_number':
      return { type: 'number', label, default: typeof p.default === 'number' ? p.default : undefined, optional: p.optional };
    case 'bool':
      return { type: 'boolean', label, default: Boolean(p.default) };
    case 'enum_values':
      return {
        type: 'enum',
        label,
        options: (p.options ?? []).map((v) => ({ value: v, label: v })),
        default: typeof p.default === 'string' ? p.default : undefined,
      };
    default:
      return { type: 'string', label, optional: p.optional };
  }
}

function inferPorts(params: GeolibreParam[], pick: 'in' | 'out'): PortKind[] {
  const ports: PortKind[] = [];
  for (const p of params) {
    if (pick === 'in' && p.type.startsWith('input_')) ports.push(p.type.includes('vector') ? 'vector' : 'raster');
    if (pick === 'out' && p.type.startsWith('output_')) ports.push(p.type.includes('vector') ? 'vector' : 'raster');
  }
  return ports;
}

/** Build GeoLab Tools from a geolibre engine instance (call after lazily importing the engine). */
export function buildGeolibreTools(engine: GeolibreEngine, version?: string): Tool[] {
  const provenance = ENGINES.geolibre(version);
  return engine.listTools().map((m): Tool => {
    const params: ParamSchema = {};
    for (const p of m.parameters) params[p.name] = mapParam(p);
    return {
      id: `geolibre:${m.id}`,
      name: m.name ?? m.id,
      summary: m.description ?? m.id,
      category: mapCategory(m.category),
      version: version ?? '0',
      params,
      inputs: inferPorts(m.parameters, 'in'),
      outputs: inferPorts(m.parameters, 'out'),
      provenance,
      tags: ['geolibre', 'whitebox'],
      async run(ctx: ToolRunContext, values: Record<string, unknown>): Promise<ToolRunResult> {
        // Build CLI args + the in-memory /work inputs the WASI runner expects, then call runTool().
        const args: string[] = [];
        const input: Record<string, Uint8Array> = {};
        for (const [key, spec] of Object.entries(m.parameters)) void key, void spec;
        for (const p of m.parameters) {
          const v = values[p.name];
          if (p.type.startsWith('input_') && typeof v === 'string') {
            const layer = ctx.layer(v);
            if (layer) {
              const file = `/work/${p.name}_${layer.id}.tif`;
              input[file.replace('/work/', '')] = await ctx.fs.read(layer.bytesRef);
              args.push(`--${p.name}=${file}`);
            }
          } else if (p.type.startsWith('output_')) {
            args.push(`--${p.name}=/work/${String(v ?? p.name)}`);
          } else if (v !== undefined && v !== null && v !== '') {
            args.push(`--${p.name}=${String(v)}`);
          }
        }
        ctx.onProgress(0.1, `running geolibre:${m.id}`);
        const { files } = await engine.runTool(m.id, { args, input });
        ctx.onProgress(0.9, 'writing outputs');
        const outputs = await Promise.all(
          Object.entries(files).map(async ([name, bytes]) => {
            const ref = `out/${m.id}/${name}`;
            await ctx.fs.write(ref, bytes);
            return { name, kind: 'raster' as PortKind, bytesRef: ref, format: 'COG' };
          }),
        );
        ctx.onProgress(1, 'done');
        return { outputs, log: [`geolibre:${m.id} ${args.join(' ')}`] };
      },
    };
  });
}
