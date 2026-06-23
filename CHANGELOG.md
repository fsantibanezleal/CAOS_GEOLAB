# Changelog

All notable changes to GeoLab. Format: `X.XX.XXX` (per CAOS versioning); 0.x while on the bootstrap /
pre-first-tool phase. Newest on top.

## [0.09.000] — 2026-06-23

### Added — GeoJSON upload (bring-your-own vector layer)

- **GeoJSON upload**: the "Upload layer" toolbar button now accepts both `.tif/.tiff` (raster) and
  `.geojson/.json` (vector). The file type is detected by extension; GeoJSON files go through
  `uploadGeoJSONFile()` instead of the raster path.
- **uploadGeoJSONFile**: reads bytes, calls `parseGeoJSON()` + `geojsonBbox()` + `geojsonSummary()`,
  stores bytes in the virtual FS under `data/<id>.geojson`, and adds a `WLayer` with
  `kind: 'vector'`, `geojson`, and `geoBbox` set. The layer appears immediately in the Layers panel,
  auto-switches to Map view, and the MapView renders it via the existing `applyVectorOverlay()` path.
- **Feature summary in log**: a `Loaded: N features (type…)` log line appears after upload,
  mirroring the log entry written for tool-produced vector outputs.
- **Vector layer as tool input**: `defaultsFor()` now accepts a `vectorLayerId` argument and
  pre-fills tool parameters of `type: 'layer', accepts: ['vector']` with the first available vector
  layer (or the active layer if it is a vector). `selectTool()` passes `firstVectorId()` to it.
  `collectRunArgs()` already handled vector layers via `bytesRef` — no adapter changes needed.
- **firstVectorId helper**: mirrors `firstRasterId()`, finds the first vector layer in the workspace
  (preferring the active layer if it matches).
- **i18n**: `wb.upload` → "Upload layer" / "Subir capa"; `wb.toolboxHint` + `wb.intro` + `layers.none`
  updated to mention GeoJSON; `wb.uploadHint` added (EN + ES) for future tooltip use.
- All packages bumped to 0.9.0; footer display string → `v0.09.000`.
- `pnpm -C apps/web typecheck` clean; `pnpm -C apps/web build` green.
- No browser in cloud env → screenshot **skipped** (stated explicitly).

## [0.08.000] — 2026-06-23

### Added — render non-raster tool outputs

- **Vector output rendering**: when a tool produces a `.geojson` output (`kind: 'vector'`), the bytes are
  decoded as UTF-8, parsed with `parseGeoJSON()`, and added to the workspace as a vector layer. The Map
  view renders it as three MapLibre GL layers — fill (Polygon/MultiPolygon), line (LineString + outline),
  and circle (Point/MultiPoint) — all in the GeoLab accent colour.
- **Auto-bounds**: `geojsonBbox()` in `lib/geojson.ts` computes `[minLon, minLat, maxLon, maxLat]` from
  the feature coordinates so `fitBounds()` zooms the map to the result automatically.
- **Auto-switch to Map**: when the active layer changes to `kind: 'vector'`, the workbench center panel
  automatically switches from Grid to Map mode; the Grid tab becomes disabled with a tooltip.
- **Text / table output panel**: tools that produce `text`, `table`, or `pointcloud` outputs have their
  bytes decoded as UTF-8 and shown in a `TextOutputPanel` (scrollable monospace pre block, max 340 px).
  The Grid/Map toggle is hidden — neither applies to non-spatial text.
- **Pointcloud info hint**: when the output is a binary LiDAR file (`kind: 'pointcloud'`), the panel adds
  a notice explaining the file is binary and directs the user to the tool log for statistics.
- **Vector feature summary in log**: after a vector run, the log line `vector output: N features (type…)`
  gives an immediate summary without switching views.
- **MapView extended**: `MapView` now accepts `geojson: GeoJSONFeatureCollection | null` and `geoBbox`
  props. Raster and vector overlays share the same map instance (one active at a time); each effect clears
  the other's source + layers before applying. `GeoJSONSource.setData()` is used for in-place updates
  (no source removal round-trip on data change).
- New files: `lib/geojson.ts` (parse + bbox + summary); `components/TextOutputPanel.tsx`.
- New CSS: `.text-out-panel`, `.text-out-pre`, `.vtab:disabled`.
- `pnpm -C apps/web typecheck` clean; `pnpm -C apps/web build` green (1657 modules, 13 s).
- No browser in cloud env → screenshot **skipped** (stated explicitly).
- Merged via **PR #12** → develop.

## [0.07.000] — 2026-06-23

### Added — Refined auto-forms

- **Output-only schema detection**: tools whose entire parameter schema consists only of output specs
  (no input parameters) now render a clear "No input parameters required — click Run to proceed"
  affordance instead of a silent empty form.
- **Number/integer widgets**: `min`, `max`, and `step` constraints from `ParamSpec` are now passed to
  the `<input type="number">` element, preventing out-of-range values at the browser level.
- **Extent widget** (`type: 'extent'`): the "coming" placeholder is replaced with a real 4-input
  bounding-box form (Min X / Min Y / Max X / Max Y). Values are stored as `[number, number, number,
  number]` and formatted as a comma-separated string when passed as a CLI arg.
- **Multiline string widget**: `ParamSpec` `{ type: 'string', multiline: true }` renders a `<textarea>`
  instead of a single-line text input.
- **File widget** (`type: 'file'`): replaces the "coming" placeholder with an `<input type="file">` that
  reads the file bytes asynchronously (via `arrayBuffer()`) and stores `{ name, bytes }` in the params
  state. `collectRunArgs` in `@geolab/adapter-geolibre` now handles these file-value objects — adds the
  bytes to the input map and emits the correct `--param=/work/<name>` CLI argument.
- **Layer availability hint**: when a `type: 'layer'` param requires a layer kind that has no matching
  layers in the workspace (e.g. vector or pointcloud), the widget shows "No [kind] layers — generate or
  upload one first" instead of an empty/confusing dropdown.
- **Optional param label**: optional (non-required) parameters now show an `(optional)` label suffix,
  making required vs optional fields immediately clear.
- **Pre-run validation**: `runSelected()` in the Workbench now validates all required params before
  dispatching to the Web Worker. Missing required fields are highlighted with a red border and an inline
  "Required" error message; errors clear automatically as the user fills them in.
- `collectRunArgs` now handles array values (extent `[minX,minY,maxX,maxY]` → comma-joined string) and
  file-like values (`{name, bytes}` → added to the input map with a `/work/<name>` path arg).
- No browser in cloud env → screenshot **skipped** (stated explicitly).

## [0.06.001] — 2026-06-23

### Fixed
- **MapLibre basemap now renders.** v0.06.000 added a `coi-serviceworker` (COEP `require-corp`) that
  cross-origin-isolated the page and **blocked the cross-origin basemap tiles** — and nothing in GeoLab
  needs cross-origin isolation (the geolibre WASI engine is single-threaded; it ran fine without COI in
  v0.02–v0.04). Removed the COI serviceworker and switched the basemap to an **OSM raster** style.
  Screenshot-verified (headless): OSM tiles load (HTTP 200), `crossOriginIsolated=false`, the georeferenced
  overlay sits correctly on the world map, 0 console errors.

### Added (infra)
- **GitHub Pages deploy workflow** (`.github/workflows/deploy-pages.yml`, on push to `main`) + `public/CNAME`
  (`geolab.fasl-work.com`). Inert until the repo is made public + Pages is enabled (go-live runbook in
  CAOS_MANAGE `deployments/geolab.md`).

## [0.06.000] — 2026-06-23

### Added — MapLibre basemap + COI serviceworker
- **MapLibre GL JS basemap**: raster layers are now viewable as georeferenced overlays on an interactive
  world basemap (MapLibre GL JS v5 + `demotiles.maplibre.org` style, no API key required).
- **Grid / Map toggle** in the workbench center panel: switch between the pixel-grid canvas view
  (colormap + value read-out) and the map view (basemap + raster overlay) for any active raster layer.
- **Auto-WGS84 bounding box**: uses `GeoTiffReader.bounds_lonlat()` from geolibre-wasm to extract the
  WGS84 geographic extent of any GeoTIFF/COG directly, without proj4 or a separate reprojection step.
  The bounds are read for synthetic DEMs, uploaded files, and all tool outputs.
- **`coi-serviceworker`**: installs a service worker that adds `Cross-Origin-Opener-Policy: same-origin`
  and `Cross-Origin-Embedder-Policy: require-corp` headers — required for `SharedArrayBuffer` (WASM
  threads) to work on GitHub Pages and other hosted environments.
- No browser in cloud env → screenshot **skipped** (stated explicitly).

## [0.05.000] — 2026-06-23

### Added — Web Worker runner (off-main-thread WASM execution)
- Tool runs are now **off the main thread**: a dedicated Web Worker loads the geolibre-wasm engine once
  and handles all `runTool()` calls, so the browser UI stays fully responsive during the (sometimes
  multi-second) WASM computation.
- A **progress bar** (fraction 0→1 + status message) appears in the right panel while a tool runs.
- A **Cancel button** aborts the pending result (the current WASM call completes inside the worker but
  the output is discarded; the UI returns to idle immediately).
- The worker is a module-level singleton — it lives across Workbench re-renders and warms up on the
  first run (the engine loads once, subsequent runs skip the 22 MB WASM load).
- New: `src/workers/geolibre-worker.ts` (the worker); `src/lib/useWorkerRunner.ts` (the React hook).
- Adapter: `collectRunArgs()` and `guessOutputKind()` exported as standalone helpers so the main thread
  can prepare run args + infer output types independently of the `Tool.run()` closure.
- Engine loader: `getGeolibreManifest(toolId)` exported from `src/engines/geolibre.ts` (returns the
  raw geolibre manifest for a given GeoLab tool id, from the in-memory manifest cache).

## [0.04.001] — 2026-06-22

### Added
- A **colorbar legend** under each raster canvas — the active colormap as a gradient + min / mid / max
  labels (with units) — so the colormap is readable.

## [0.04.000] — 2026-06-22

### Added — the generic workbench (run ANY of the 747 tools)
- Replaced the slope-only demo with a real **3-column workbench**: a **Toolbox** (all 747 tools, by
  category, searchable) → pick any → its **auto-form** (from the ParamSchema) → **Run** on the active layer;
  a **Layers** panel (sample DEM, uploads, tool outputs) with click-to-render + remove; and a canvas that
  renders the active raster layer with a **colormap selector** (viridis / terrain / gray) + value read-out
  at the cursor.
- **Bring-your-own GeoTIFF** — upload a raster (read with geolibre's reader) and it becomes a layer you can
  run tools on. Your data never leaves the browser.
- Tool outputs become new raster layers, with provenance/lineage (`producedBy`).
- New components: `Toolbox`, `LayersPanel`; the Workbench is now a workspace (InMemoryFS + layers + tools).
- **Screenshot-verified** (headless Chromium): generate DEM → pick **Slope from the 747-tool tree** → run →
  2 layers, the result renders correctly, `exit 0`, 0 console errors, light + dark.

### Known / next
- Some tools with implicit/all-output params render a minimal auto-form (they still run from defaults) — to
  refine. A **Web-Worker** runner (off-main-thread + progress/cancel) and a **MapLibre** basemap (georef
  overlay) are the next increments.

## [0.03.000] — 2026-06-22

### Added — first real analysis, end-to-end, in the browser
- The **Workbench runs a real WhiteboxTools tool — Slope — entirely client-side**: generate a synthetic
  georeferenced DEM, auto-form the tool's params (input layer / units / z_factor) from its ParamSchema, run
  it via the WASM engine, and render the COG result on an interactive canvas (colormap + value read-out at
  the cursor) with the tool's provenance chip and run log.
- New pieces: `tool-core` **InMemoryFS**; **RasterCanvas** (colormap + hover read-out — the interactivity
  rubric); **ParamForm** (auto-form generated from a ParamSchema — the QGIS-Processing pattern); `colormap`
  (TERRAIN / VIRIDIS); a synthetic-DEM generator.
- **All raster I/O goes through geolibre's OWN browser lib** (`CogBuilder.write_f32` +
  `geotiff_read_band_f64`). geotiff.js mis-encodes/mis-decodes geolibre's tiled COGs (confirmed by probing:
  garbage pixels → a bogus slope cliff), so it was dropped. Verified in Node: slope 0.02–11.6°, flat at
  summits, steep on flanks.
- **Screenshot-verified** (headless Chromium): DEM + slope render correctly (slope shows the expected
  high-slope rings around the hill flanks), `exit 0`, 0 console errors, light + dark.

### Changed
- Dropped the `geotiff` dependency — replaced entirely by geolibre's reader/writer.

## [0.02.000] — 2026-06-22

### Added — the real geolibre engine, live in the browser
- `adapters/geolibre` rewritten against the **real** `geolibre-wasm@0.4.4` API (verified by probing the
  package): `listManifests()` + the actual param schema `{ name, data_kind, io_role, required, schema }` +
  `runTool() → { exitCode, stdout, files }`. **747 tools** across Conversion / Hydrology / Lidar / Other /
  Raster / Terrain / Vector; provenance distinguishes WhiteboxTools vs GeoLibre-authored.
- `apps/web` **Tools** page: lazily loads the ~22 MB WASM engine **in the browser** and lists all 747 tools
  grouped by category, searchable, each with a provenance + license chip.
- Vite **code-splits** the engine — `geolibre-cli.wasm` (17.6 MB) + the Tools chunk load on demand, never on
  first paint.
- **Screenshot-verified** in headless Chromium: engine loads, `LOADED_TOOL_COUNT 747`, 0 console errors,
  light + dark.

### Notes
- The `run()` path (engine → in-memory `/work` → COG output) is implemented in the adapter; the in-app
  **run + map render** (sample DEM → slope → MapLibre/canvas) is the next increment.

## [0.01.000] — 2026-06-22

### Added — bootstrap / scaffolding (ADR-0059)
- Monorepo skeleton (pnpm workspace): `apps/web`, `packages/tool-core`, `packages/adapters/*`,
  `packages/geolab-tools`, `data-pipeline/`, `docs/`.
- `tool-core`: the engine-agnostic abstractions — `Tool`, `Layer`, `Pipeline`, `Project`, `ParamSchema`,
  `Provenance`/`License`, a `ToolRegistry`, and a worker-runner interface.
- `adapters/geolibre`: scaffold that maps `geolibre-wasm` tools into the `Tool` registry with provenance.
- `geolab-tools`: scaffold for our own tools (composite + cross-engine compare).
- Web-app baseline (React 19 + Vite + Router + i18n EN-first + light/dark theme), the ADR-0016 shell stub.
- `CREDITS.md` (per-engine attribution + licenses), MIT `LICENSE`, README, scripts (`.ps1`/`.sh`),
  `.env.example`.

_Next: wire the first tool end-to-end (slope from a sample DEM) on a MapLibre canvas with its provenance
chip, screenshot-verified; then fan out adapters + the workbench UI + the pipeline editor._
