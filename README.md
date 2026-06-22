# GeoLab

**Browser-native, no-install, multi-engine geospatial tool platform.** Load a DEM / GeoTIFF / vector /
point cloud (a bundled sample **or your own file**), run **real geoprocessing tools**, **chain them into
reusable pipelines**, and explore the result on an interactive map / 3D canvas — **entirely in your
browser. No server, no Python, no GDAL install, and your data never leaves your machine.**

> Status: **v0.01.000 — bootstrap / scaffolding.** Architecture decided ([ADR-0059]); engine adapters,
> tools and the workbench UI are landing incrementally. This is not yet a finished app.

GeoLab is a CAOS research lab in the same family as SimLab / PINN-Lab / QLab. It is **inspired by
[geolibre-rust](https://github.com/opengeos/geolibre-rust) but is broader**: instead of a single engine, it
**aggregates many WebAssembly/JS geospatial engines behind one uniform tool interface**, **adds its own
original tools**, and **shows the provenance of every tool** (which engine it comes from, its authors and
license).

## Why GeoLab is different

- **Multi-engine, not one engine.** geolibre-wasm (~740 WhiteboxTools+GeoLibre tools) is *one* source.
  GeoLab also integrates GDAL, GEOS, Turf, H3, mapshaper, ITK-Wasm, wasm-vips, OpenCV.js, ONNX Runtime Web
  and more — a catalog of **1,000+ real tools**. Adding an engine is one adapter.
- **Our own tools.** Composite workflow-tools, **cross-engine comparison** (run the same operation through
  two engines and see the difference), domain analyses, and models we trained (ONNX, run in-browser).
- **Pipelines, not loose scripts.** A visual node editor chains tools into a reproducible **recipe** (JSON)
  you can save, share and re-run on new data.
- **Provenance + honesty.** Every tool shows its source engine, authors and license. The count is only what
  *genuinely runs* in the browser — never padded.
- **Zero backend, private by design.** Static-hosted (GitHub Pages); your data is processed client-side and
  never uploaded.

## Monorepo layout

```
apps/web/                 React 19 + Vite SPA — shell, workbench (map + toolbox + layers + pipeline), docs
packages/tool-core/       engine-agnostic abstractions: Tool / Layer / Pipeline / Project + runner + provenance
packages/adapters/        one adapter per engine (geolibre, gdal, geos, turf, h3, ... → Tool[])
packages/geolab-tools/    our own tools (composite workflows, cross-engine compare, domain, ONNX)
data-pipeline/            offline (.venv) — train ONNX models + build sample datasets (dormant for now)
docs/                     the documentation wiki (theory, methods, frameworks, guides)
```

## Quick start

```bash
corepack enable           # pnpm via corepack (no global installs)
pnpm install
pnpm dev                  # http://localhost:5173
pnpm build                # build all packages + the web app
```

(Windows: `scripts/setup.ps1` then `scripts/dev.ps1`. POSIX: `scripts/setup.sh`, `scripts/dev.sh`.)

## Credits

GeoLab stands on a large body of open-source work. Every integrated engine is credited in-app (a source
chip on each tool + a Credits page) and in [CREDITS.md](CREDITS.md). It builds especially on
**WhiteboxTools / whitebox_next_gen** (John Lindsay) and **geolibre-rust / GeoLibre** (opengeos / Qiusheng
Wu). See [CREDITS.md](CREDITS.md) for the full list and licenses.

## License

MIT — see [LICENSE](LICENSE). Integrated third-party engines retain their own licenses (see CREDITS.md);
GPL-licensed engines, if used, are kept as separate, optional modules and never linked into the MIT core.

<!-- links -->
[ADR-0059]: https://github.com/fsantibanezleal/CAOS_MANAGE (private — conventions/architecture/0-archetype/ADR-0059)
