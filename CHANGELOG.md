# Changelog

All notable changes to GeoLab. Format: `X.XX.XXX` (per CAOS versioning); 0.x while on the bootstrap /
pre-first-tool phase. Newest on top.

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
