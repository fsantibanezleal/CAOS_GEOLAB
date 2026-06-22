# Changelog

All notable changes to GeoLab. Format: `X.XX.XXX` (per CAOS versioning); 0.x while on the bootstrap /
pre-first-tool phase. Newest on top.

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
