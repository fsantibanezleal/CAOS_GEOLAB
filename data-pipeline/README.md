# data-pipeline/ — DORMANT for now (ADR-0057 §1)

This area exists in every CAOS product repo so the layout is uniform; GeoLab does not need it yet, so it is
**dormant**. It will hold the **offline** work (a local `.venv-pipeline`, never shipped):

- **Train ONNX models** for the ML/segmentation tools (`geolab-tools` `ml:*`) — e.g. a land-cover
  classifier — exported to ONNX and run live in-browser via `onnxruntime-web` (the ADR-0057 train→ONNX→web
  lane, reused honestly).
- **Build sample datasets** — small public derived artifacts (a sample DEM, a vector, a LiDAR tile) shipped
  in `apps/web/public/data/` so a visitor can try every tool without bringing their own file
  (ADR-0055 public-artifact rule). Heavy raw stays out of git.

Until then, GeoLab runs **entirely client-side** (ADR-0059): the tools are WASM engines in the browser, so
no server/pipeline is required for the core product.
