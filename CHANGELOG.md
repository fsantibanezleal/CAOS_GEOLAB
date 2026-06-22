# Changelog

All notable changes to GeoLab. Format: `X.XX.XXX` (per CAOS versioning); 0.x while on the bootstrap /
pre-first-tool phase. Newest on top.

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
