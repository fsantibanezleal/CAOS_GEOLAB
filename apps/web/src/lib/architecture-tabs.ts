/**
 * ADR-0058 — the in-app Architecture / "How it works" modal content for GeoLab.
 * Five themed SVG diagrams (the app + design-build flow · lanes web/offline/compute · web-app flow ·
 * the science · data contracts), each a hand-laid-out SVG using ONLY the app's palette CSS-variable
 * tokens (zero hardcoded hex) and the shared `.arch-svg` class vocabulary in styles.css. The SVGs label
 * GeoLab's REAL modules in monospace and carry labeled flows + lanes — not boxes-and-arrows filler.
 *
 * The SVG strings are inlined (dangerouslySetInnerHTML) so they inherit the theme variables live.
 */

// ── tiny SVG builder (keeps geometry exact + avoids inline-attribute drift) ──────────────────────────
const DEFS =
  '<defs><marker id="ah" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto-start-reverse">' +
  '<path d="M0,0 L7,3 L0,6 Z" class="flow-ah"/></marker></defs>';

const esc = (s: string) => s.replace(/&(?!#)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rect = (x: number, y: number, w: number, h: number, cls: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="${cls}"/>`;
const tx = (x: number, y: number, cls: string, s: string) => `<text x="${x}" y="${y}" class="${cls}">${esc(s)}</text>`;
const tc = (x: number, y: number, cls: string, s: string) =>
  `<text x="${x}" y="${y}" text-anchor="middle" class="${cls}">${esc(s)}</text>`;
const flow = (x1: number, y1: number, x2: number, y2: number, dash = false) =>
  `<path d="M${x1},${y1} L${x2},${y2}" class="flow${dash ? ' dash' : ''}" marker-end="url(#ah)"/>`;
const elbow = (x1: number, y1: number, x2: number, y2: number) =>
  `<path d="M${x1},${y1} L${x1},${(y1 + y2) / 2} L${x2},${(y1 + y2) / 2} L${x2},${y2}" class="flow" marker-end="url(#ah)"/>`;

type Line = [cls: 'it' | 'cd' | 'mu' | 'eq', text: string];
function card(x: number, y: number, w: number, h: number, cls: string, title: string, lines: Line[]): string {
  let s = rect(x, y, w, h, cls) + tx(x + 11, y + 19, 'ttl', title);
  let ty = y + 35;
  for (const [c, text] of lines) {
    s += tx(x + 11, ty, c, text);
    ty += 14;
  }
  return s;
}
const band = (x: number, y: number, w: number, h: number, label: string) =>
  rect(x, y, w, h, 'band') + tx(x + 12, y + 17, 'lane-ttl', label);
const svg = (h: number, inner: string) =>
  `<svg class="arch-svg" viewBox="0 0 880 ${h}" width="880" role="img" xmlns="http://www.w3.org/2000/svg">${DEFS}${inner}</svg>`;

// ── Tab 1 · The app + the design/build lifecycle ─────────────────────────────────────────────────────
const SVG_APP = svg(
  348,
  tc(440, 18, 'lane-ttl', 'GeoLab — a multi-engine, browser-native geospatial platform') +
    // Band A — the app
    band(12, 30, 856, 132, 'THE APP — what you use') +
    card(24, 50, 256, 50, 'bx-hi', 'Workbench', [['cd', 'pages/Workbench.tsx']]) +
    card(312, 50, 256, 50, 'bx-hi', 'Pipeline editor', [['cd', 'pages/Pipeline.tsx']]) +
    card(600, 50, 256, 50, 'bx-hi', 'Tools catalog', [['cd', 'pages/Tools.tsx']]) +
    flow(152, 100, 350, 118) +
    flow(440, 100, 440, 118) +
    flow(728, 100, 530, 118) +
    card(245, 118, 390, 36, 'bx', 'Tool Registry', [['cd', 'tool-core/registry.ts — catalog + provenance']]) +
    // Band B — design/build lifecycle
    band(12, 178, 856, 158, 'DESIGN & BUILD LIFECYCLE — how it was made') +
    card(24, 200, 152, 116, 'bx', '1 · Research', [
      ['cd', 'ADR-0059'],
      ['it', 'no-install,'],
      ['it', 'multi-engine'],
      ['mu', 'registry pattern'],
    ]) +
    card(192, 200, 156, 116, 'bx-compute', '2 · Bake (offline)', [
      ['cd', 'data-pipeline/'],
      ['cd', 'whitebox/'],
      ['cd', 'dump_params.py'],
      ['mu', 'Python whitebox'],
    ]) +
    card(364, 200, 152, 116, 'bx', '3 · Adapters', [
      ['cd', 'adapters/geolibre'],
      ['cd', 'adapters/turf'],
      ['cd', 'adapters/h3'],
      ['mu', 'engines → Tool[]'],
    ]) +
    card(532, 200, 152, 116, 'bx', '4 · Build SPA', [
      ['cd', 'Vite · React 19'],
      ['it', 'pnpm build'],
      ['mu', 'static bundle'],
    ]) +
    card(700, 200, 156, 116, 'bx-web', '5 · Deploy', [
      ['cd', 'GitHub Pages'],
      ['it', 'geolab.fasl-work'],
      ['it', '.com'],
      ['mu', 'no backend'],
    ]) +
    flow(176, 258, 192, 258) +
    flow(348, 258, 364, 258) +
    flow(516, 258, 532, 258) +
    flow(684, 258, 700, 258) +
    tc(184, 250, 'lbl', 'JSON') +
    tc(356, 250, 'lbl', 'map') +
    tc(524, 250, 'lbl', 'bundle') +
    tc(692, 250, 'lbl', 'ship'),
);

// ── Tab 2 · Lanes — web / offline / compute (the core split) ─────────────────────────────────────────
const SVG_LANES = svg(
  432,
  // Lane 1 — WEB
  band(12, 22, 856, 158, 'LANE 1 · WEB — live, in your browser (all analysis runs here)') +
    card(24, 44, 268, 110, 'bx-web', 'geolibre (WASM)', [
      ['cd', 'workers/geolibre-worker.ts'],
      ['cd', 'geolibre-cli.wasm · WASI'],
      ['it', '747 WhiteboxTools/GeoLibre'],
      ['mu', 'Web Worker — UI responsive'],
    ]) +
    card(306, 44, 268, 110, 'bx-web', 'Turf.js + H3 (Uber)', [
      ['cd', 'engines/turf.ts · h3.ts'],
      ['it', 'vector ops · hex indexing'],
      ['mu', 'JavaScript — main thread'],
    ]) +
    card(588, 44, 268, 110, 'bx-web', 'COG I/O + render', [
      ['cd', 'engines/geolibre-io.ts'],
      ['cd', 'components/MapView.tsx'],
      ['it', 'read/write COG · MapLibre'],
      ['mu', 'Float32 grid · colormap'],
    ]) +
    // Lane 2 — OFFLINE / COMPUTE
    band(12, 196, 856, 110, 'LANE 2 · OFFLINE / COMPUTE — build-time only, never your data') +
    card(24, 218, 400, 78, 'bx-compute', 'Bake tool metadata', [
      ['cd', 'data-pipeline/whitebox/dump_params.py'],
      ['it', 'runs the Python whitebox package once'],
      ['mu', 'authoritative params · enums · types'],
    ]) +
    card(456, 218, 400, 78, 'bx-store', 'Baked artifact (committed)', [
      ['cd', 'adapters/geolibre/src/whitebox-params.json'],
      ['it', '484 tools — fills 138 empty manifests'],
      ['mu', 'shipped in the bundle, not fetched'],
    ]) +
    flow(424, 257, 456, 257) +
    tc(440, 249, 'lbl', 'JSON') +
    // Lane 3 — REPRODUCIBILITY
    band(12, 322, 856, 100, 'LANE 3 · REPRODUCIBILITY — the on-demand replay analogue') +
    card(24, 344, 400, 68, 'bx-hi', 'Recipe (pipeline DAG)', [
      ['cd', 'tool-core/types.ts → Recipe'],
      ['it', 'nodes + edges + pinned tool versions + input hashes'],
    ]) +
    card(456, 344, 400, 68, 'bx', 'Privacy guarantee', [
      ['it', 'VirtualFS lives in memory only — no upload, no telemetry'],
      ['mu', 'cleared on page reload'],
    ]),
);

// ── Tab 3 · Web-app flow — one tool run, end to end ──────────────────────────────────────────────────
const flowStep = (i: number, title: string, lines: Line[], cls = 'bx') => {
  const x = 15 + i * 144;
  return card(x, 60, 130, 150, cls, title, lines);
};
const SVG_WEBFLOW = svg(
  250,
  tc(440, 22, 'lane-ttl', 'One tool run — data flows entirely inside the browser') +
    // worker boundary behind step 5
    `<rect x="${15 + 4 * 144 - 6}" y="44" width="142" height="182" rx="10" class="gate"/>` +
    tc(15 + 4 * 144 + 59, 40, 'lbl', 'Web Worker') +
    flowStep(0, '1 · Input', [['cd', 'lib/samples/*'], ['it', '+ upload'], ['mu', 'GeoTIFF · GeoJSON'], ['mu', 'LAS · CSV']]) +
    flowStep(1, '2 · Virtual FS', [['cd', 'tool-core/fs.ts'], ['it', 'bytes under'], ['cd', '/work'], ['mu', 'InMemoryFS']]) +
    flowStep(2, '3 · Auto-form', [['cd', 'ParamForm.tsx'], ['it', 'from typed'], ['it', 'ParamSchema'], ['mu', 'layer · field']]) +
    flowStep(3, '4 · Build args', [['cd', 'collectRunArgs'], ['cd', 'adapters/geolibre'], ['it', '--input/--output'], ['mu', '+ field flags']]) +
    flowStep(4, '5 · Engine', [['cd', 'runTool()'], ['it', 'WASM (WASI)'], ['it', 'or tool.run()'], ['mu', 'JS for Turf/H3']], 'bx-web') +
    flowStep(5, '6 · Result', [['cd', 'geolibre-io.ts'], ['it', 'decode COG /'], ['it', 'parse GeoJSON'], ['mu', 'new Layer ↓']], 'bx-hi') +
    flow(145, 135, 159, 135) +
    flow(289, 135, 303, 135) +
    flow(433, 135, 447, 135) +
    flow(577, 135, 591, 135) +
    flow(721, 135, 735, 135) +
    tc(152, 127, 'lbl', 'bytes') +
    tc(296, 127, 'lbl', 'schema') +
    tc(440, 127, 'lbl', 'args') +
    tc(584, 127, 'lbl', 'post') +
    tc(728, 127, 'lbl', 'bytes'),
);

// ── Tab 4 · The science — real geoprocessing methods + equations ─────────────────────────────────────
const sciLane = (y: number, label: string, steps: string[], eq: string) => {
  let s = tx(24, y + 4, 'lane-ttl', label);
  const sy = y + 14;
  let x = 24;
  steps.forEach((st, i) => {
    s += rect(x, sy, 118, 34, 'bx') + tc(x + 59, sy + 21, 'cd', st);
    if (i < steps.length - 1) s += flow(x + 118, sy + 17, x + 130, sy + 17);
    x += 130;
  });
  s += rect(572, sy, 284, 34, 'bx-hi') + tx(584, sy + 21, 'eq', eq);
  return s;
};
const SVG_SCIENCE = svg(
  336,
  tc(440, 18, 'lane-ttl', 'The science — the real algorithms behind the tools') +
    sciLane(40, 'Terrain morphometry', ['DEM', 'slope', 'aspect'], 'S = atan √((∂z/∂x)² + (∂z/∂y)²)') +
    sciLane(116, 'Hydrology', ['fill_depr.', 'd8_pointer', 'flow_accum'], 'D8 single-flow direction → Σ upslope') +
    sciLane(192, 'Interpolation / geostats', ['points', 'idw', 'variogram'], 'ẑ = Σ wᵢzᵢ / Σ wᵢ ,  wᵢ = 1/dᵢᵖ') +
    sciLane(268, 'LiDAR point cloud', ['LAS', 'classify', 'grid → DSM'], 'γ(h) = 1/2N Σ (z(xᵢ) − z(xᵢ+h))²'),
);

// ── Tab 5 · Data contracts / design ──────────────────────────────────────────────────────────────────
const SVG_CONTRACTS = svg(
  360,
  // ingestion contract
  band(12, 22, 856, 92, 'INGESTION CONTRACT — your data → the virtual filesystem') +
    card(24, 42, 188, 60, 'bx', 'raster', [['cd', 'GeoTIFF / COG .tif']]) +
    card(220, 42, 188, 60, 'bx', 'vector', [['cd', 'GeoJSON .geojson']]) +
    card(416, 42, 188, 60, 'bx', 'pointcloud', [['cd', 'LAS 1.2 .las']]) +
    card(612, 42, 132, 60, 'bx', 'table', [['cd', 'CSV .csv']]) +
    card(752, 42, 104, 60, 'bx-hi', '/work', [['cd', 'extOf()']]) +
    flow(744, 72, 752, 72) +
    // tool contract
    band(12, 130, 420, 100, 'TOOL CONTRACT') +
    card(24, 150, 396, 74, 'bx', 'Tool — tool-core/types.ts', [
      ['it', 'ParamSchema (typed) → auto-form'],
      ['it', 'inputs / outputs : PortKind'],
      ['mu', 'Provenance — engine · license tier'],
    ]) +
    // param synthesis contract
    band(448, 130, 420, 100, 'PARAM-SYNTHESIS CONTRACT (D1/D2)') +
    card(460, 150, 396, 74, 'bx-compute', 'effectiveParams() — adapters/geolibre', [
      ['it', 'synthesizeParams · reclassifyStringFile'],
      ['it', 'reclassifyField → field selector'],
      ['mu', 'enriched by whitebox-params.json'],
    ]) +
    // reproducibility + license gate
    band(12, 246, 856, 104, 'REPRODUCIBILITY & PROVENANCE') +
    card(24, 266, 410, 76, 'bx-hi', 'Recipe', [
      ['cd', 'tool-core/types.ts → Recipe'],
      ['it', 'DAG + pinned versions + input hashes'],
      ['mu', 'share · re-run exactly'],
    ]) +
    card(446, 266, 410, 76, 'bx', 'License-tier gate', [
      ['it', 'permissive → core · copyleft → segregated'],
      ['mu', 'per-tool source chip + Credits page'],
    ]),
);

export interface ArchTab {
  id: string;
  en: string;
  es: string;
  svg: string;
  body_en: string;
  body_es: string;
}

export const ARCH_TABS: ArchTab[] = [
  {
    id: 'app',
    en: 'The app',
    es: 'La app',
    svg: SVG_APP,
    body_en:
      'GeoLab is a multi-engine geospatial platform that runs entirely in your browser. Three surfaces — Workbench, Pipeline editor and Tools catalog — sit on a unified Tool Registry. It was built by baking tool metadata offline, mapping each engine through a standard adapter, then bundling a static SPA deployed to GitHub Pages with no backend.',
    body_es:
      'GeoLab es una plataforma geoespacial multi-motor que corre completa en tu navegador. Tres superficies — Banco de trabajo, Editor de Pipeline y Catálogo de herramientas — se apoyan en un Registro de Herramientas unificado. Se construyó horneando la metadata de las herramientas offline, mapeando cada motor con un adaptador estándar y empaquetando una SPA estática desplegada en GitHub Pages, sin backend.',
  },
  {
    id: 'lanes',
    en: 'Lanes',
    es: 'Carriles',
    svg: SVG_LANES,
    body_en:
      'What runs WHERE — the core split. The WEB lane runs every analysis live in the browser: geolibre as WASM in a Web Worker, Turf/H3 on the main thread, COG I/O and MapLibre rendering. The OFFLINE/COMPUTE lane runs only at build time (the Python whitebox bake that produces whitebox-params.json) and never touches your data. The third lane is reproducibility: a Recipe re-runs an analysis exactly, the on-demand analogue of a deterministic replay.',
    body_es:
      'Qué corre DÓNDE — la división central. El carril WEB ejecuta todo el análisis en vivo en el navegador: geolibre como WASM en un Web Worker, Turf/H3 en el hilo principal, I/O de COG y renderizado MapLibre. El carril OFFLINE/COMPUTE corre solo en build (el horneado Python whitebox que produce whitebox-params.json) y nunca toca tus datos. El tercer carril es reproducibilidad: una Receta re-ejecuta un análisis exactamente, el análogo on-demand de un replay determinista.',
  },
  {
    id: 'webflow',
    en: 'Web-app flow',
    es: 'Flujo web',
    svg: SVG_WEBFLOW,
    body_en:
      'A single tool run, end to end. Your file or a synthetic sample lands in the in-memory VirtualFS under /work. The tool’s typed ParamSchema auto-generates the form; collectRunArgs turns your inputs into CLI flags; the engine runs (WASM in a Web Worker, or JS for Turf/H3); the output bytes are decoded into a new Layer you can inspect and download. Nothing is sent to a server.',
    body_es:
      'Una corrida de herramienta, de principio a fin. Tu archivo o una muestra sintética entra al VirtualFS en memoria bajo /work. El ParamSchema tipado de la herramienta auto-genera el formulario; collectRunArgs convierte tus entradas en flags CLI; el motor corre (WASM en un Web Worker, o JS para Turf/H3); los bytes de salida se decodifican en una Capa nueva que puedes inspeccionar y descargar. Nada se envía a un servidor.',
  },
  {
    id: 'science',
    en: 'The science',
    es: 'La ciencia',
    svg: SVG_SCIENCE,
    body_en:
      'The real algorithms, not black boxes. Terrain morphometry derives slope/aspect from a DEM (Horn’s method). Hydrology builds D8 flow direction → accumulation → basins. Interpolation/geostatistics covers IDW (inverse-distance weighting) and the directional variogram. LiDAR classifies a point cloud and grids it to a surface. Each family chains the genuine GeoLab tool ids shown in the diagram.',
    body_es:
      'Los algoritmos reales, no cajas negras. La morfometría del terreno deriva pendiente/orientación desde un DEM (método de Horn). La hidrología construye dirección de flujo D8 → acumulación → cuencas. La interpolación/geoestadística cubre IDW (ponderación por inverso de la distancia) y el variograma direccional. LiDAR clasifica una nube de puntos y la interpola a una superficie. Cada familia encadena los tool ids reales de GeoLab que muestra el diagrama.',
  },
  {
    id: 'contracts',
    en: 'Data contracts',
    es: 'Contratos',
    svg: SVG_CONTRACTS,
    body_en:
      'How the system is designed to be correct and bring-your-own-data. The ingestion contract maps each data kind to a format under /work. The tool contract (ParamSchema + PortKind I/O + Provenance) lets the UI auto-build forms and show licensing. The param-synthesis contract (D1/D2) repairs geolibre’s 138 empty manifests from the baked WhiteboxTools metadata. The Recipe makes any run reproducible, and a license-tier gate decides where each tool may live.',
    body_es:
      'Cómo se diseña el sistema para ser correcto y aceptar tus propios datos. El contrato de ingesta mapea cada tipo de dato a un formato bajo /work. El contrato de herramienta (ParamSchema + I/O PortKind + Provenance) permite a la UI auto-construir formularios y mostrar licencias. El contrato de síntesis de parámetros (D1/D2) repara los 138 manifiestos vacíos de geolibre desde la metadata horneada de WhiteboxTools. La Receta hace reproducible cualquier corrida, y una compuerta por tier de licencia decide dónde puede vivir cada herramienta.',
  },
];
