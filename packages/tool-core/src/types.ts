/**
 * GeoLab core type contract (engine-agnostic). ADR-0059.
 *
 * Every geoprocessing capability — whether it comes from geolibre-wasm, GDAL, GEOS, Turf, or our own
 * `geolab-tools` — is exposed as a {@link Tool}. A Tool declares a typed {@link ParamSchema} (so the UI
 * can auto-generate its form), typed I/O ports, a {@link Provenance} record (so the UI can show where it
 * comes from), and a `run()` that executes on a {@link ToolRunContext} (off the main thread).
 *
 * Tools chain into a {@link Pipeline} (a DAG) that serialises to a shareable {@link Recipe} — the
 * reproducibility unit (recipe + input hash + pinned tool versions), the on-demand analogue of a
 * deterministic-replay trace.
 */

/** The kind of data flowing on a tool port / held by a workspace layer. */
export type PortKind = 'raster' | 'vector' | 'pointcloud' | 'table' | 'text' | 'scalar';

/** Top-level tool taxonomy (mirrors WhiteboxTools + GeoLibre; scales to thousands — dossier 04 §5). */
export type ToolCategory =
  | 'data-io'
  | 'projections-crs'
  | 'terrain-morphometry'
  | 'hydrology'
  | 'stream-network'
  | 'lidar-pointcloud'
  | 'imagery-remote-sensing'
  | 'vector-gis'
  | 'raster-math-stats'
  | 'spatial-statistics'
  | 'ml-segmentation'
  | 'cartography-render'
  | 'workflow-composite';

// ───────────────────────────── Provenance & licensing (dossier 05 §4) ─────────────────────────────

/** License classification — drives where a tool may live (core vs segregated module) + the source chip. */
export type LicenseTier = 'permissive' | 'weak-copyleft' | 'strong-copyleft';

export interface License {
  /** SPDX identifier, e.g. "MIT", "Apache-2.0", "BSD-3-Clause", "MPL-2.0", "LGPL-2.1", "GPL-3.0". */
  spdx: string;
  tier: LicenseTier;
}

/** Where a tool came from — shown in the UI (source chip + Credits page) and used for license compliance. */
export interface Provenance {
  /** Short engine id, e.g. "geolibre", "gdal", "geos", "turf", "h3", "geolab" (our own). */
  engine: string;
  /** Human upstream project name, e.g. "WhiteboxTools / geolibre-rust". */
  upstreamProject: string;
  authors: string;
  license: License;
  /** Engine/tool version, pinned for reproducibility. */
  version?: string;
  url: string;
  /** Optional academic citation (DOI/URL) for the underlying method. */
  citation?: string;
}

// ───────────────────────────── Parameter schema → auto-generated forms (dossier 04 §3) ─────────────

export type ParamSpec =
  | { type: 'number'; label: string; default?: number; min?: number; max?: number; step?: number; help?: string; optional?: boolean }
  | { type: 'integer'; label: string; default?: number; min?: number; max?: number; help?: string; optional?: boolean }
  | { type: 'boolean'; label: string; default?: boolean; help?: string }
  | { type: 'enum'; label: string; options: Array<{ value: string; label: string }>; default?: string; help?: string }
  | { type: 'string'; label: string; default?: string; multiline?: boolean; help?: string; optional?: boolean }
  /** Pick a workspace layer of one of `accepts` kinds (the auto-form renders a layer dropdown). */
  | { type: 'layer'; label: string; accepts: PortKind[]; help?: string; optional?: boolean }
  /** Pick a field/attribute name of a vector layer chosen in another param. */
  | { type: 'field'; label: string; fromLayerParam: string; help?: string; optional?: boolean }
  /** A coordinate reference system (proj4/EPSG). */
  | { type: 'crs'; label: string; default?: string; help?: string }
  /** A bounding box, typically drawn on the map. */
  | { type: 'extent'; label: string; help?: string; optional?: boolean }
  /** Bring-your-own file (never uploaded — read in-browser). */
  | { type: 'file'; label: string; accept?: string[]; help?: string }
  /** A named output the tool will produce. */
  | { type: 'output'; label: string; kind: PortKind; defaultName?: string };

/** A tool's full parameter set, keyed by param id → spec. */
export type ParamSchema = Record<string, ParamSpec>;

// ───────────────────────────── Layers, workspace, run context ─────────────────────────────

export interface Layer {
  id: string;
  name: string;
  kind: PortKind;
  /** CRS as an EPSG/proj string, e.g. "EPSG:4326". */
  crs?: string;
  /** [minX, minY, maxX, maxY] in the layer CRS. */
  extent?: [number, number, number, number];
  bands?: number;
  /** Cheap summary stats for the inspector (min/max/mean/...). */
  stats?: Record<string, number>;
  /** Standard format tag, e.g. "COG", "GTiff", "GeoJSON", "FlatGeobuf", "LAZ". */
  format?: string;
  /** Handle to the bytes in the virtual FS / OPFS. */
  bytesRef: string;
  /** The chain of tools/engines that produced this layer (provenance/lineage). */
  producedBy?: Provenance[];
}

export type ProgressFn = (fraction: number, message?: string) => void;

/** A minimal virtual filesystem the tools read/write (in-memory or OPFS-backed). */
export interface VirtualFS {
  read(path: string): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

/** Execution context handed to `Tool.run` (runs off the main thread; supports progress + cancel). */
export interface ToolRunContext {
  fs: VirtualFS;
  /** Resolve a `layer` param id to a workspace Layer. */
  layer(id: string): Layer | undefined;
  signal: AbortSignal;
  onProgress: ProgressFn;
}

export interface ToolOutput {
  name: string;
  kind: PortKind;
  /** Resulting bytes ref in the FS (for raster/vector/pointcloud) or inline value (scalar/text). */
  bytesRef?: string;
  value?: unknown;
  format?: string;
}

export interface ToolRunResult {
  outputs: ToolOutput[];
  /** Optional log lines surfaced in the console panel. */
  log?: string[];
}

/** Bilingual, didactic guide attached to a tool (ADR-0016 content depth). */
export interface ToolGuide {
  what: { en: string; es: string };
  why?: { en: string; es: string };
  /** KaTeX-ready math for the method. */
  math?: string;
  example?: { en: string; es: string };
  gotchas?: { en: string; es: string };
}

// ───────────────────────────── The Tool ─────────────────────────────

export interface Tool<P extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  summary: string;
  category: ToolCategory;
  version: string;
  params: ParamSchema;
  inputs: PortKind[];
  outputs: PortKind[];
  provenance: Provenance;
  tags?: string[];
  guide?: ToolGuide;
  run(ctx: ToolRunContext, params: P): Promise<ToolRunResult>;
}

// ───────────────────────────── Pipelines, recipes, projects (dossier 04 §4) ─────────────────────

export interface PipelineNode {
  id: string;
  toolId: string;
  params: Record<string, unknown>;
}
export interface PipelinePort {
  node: string;
  /** Port index on that node. */
  port: number;
}
export interface PipelineEdge {
  from: PipelinePort;
  to: PipelinePort;
}
export interface Pipeline {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

/** The reproducible, shareable serialisation of a pipeline run (provenance/lineage). */
export interface Recipe {
  schemaVersion: 1;
  pipeline: Pipeline;
  /** toolId → pinned version, so a recipe reproduces exactly. */
  toolVersions: Record<string, string>;
  /** Optional content hashes of the inputs the recipe was authored against. */
  inputHashes?: Record<string, string>;
  createdWith: string; // e.g. "GeoLab 0.01.000"
}

export interface Project {
  id: string;
  name: string;
  layers: Layer[];
  pipelines: Pipeline[];
}
