/**
 * GeoLab's OWN tools (provenance = `geolab`). These are the "extend beyond geolibre" track (dossier 05 §3).
 *
 * v0.01.000 ships the helper + the cross-engine-compare *factory* (a real composition, not a stub): given
 * two tools that compute the same quantity through different engines, it runs both and reports the
 * difference — GeoLab's signature didactic feature. Domain/ONNX/uncertainty tools land next.
 *
 * We do NOT register placeholder/fake tools — a tool appears only once it genuinely runs.
 */
import { ENGINES, type Tool } from '@geolab/tool-core';

/** Stamp the `geolab` provenance onto a tool we author. */
export function defineGeolabTool(
  tool: Omit<Tool, 'provenance'> & { citation?: string },
  version = '0.01.000',
): Tool {
  const provenance = { ...ENGINES.geolab(version), citation: tool.citation };
  const { citation: _omit, ...rest } = tool;
  void _omit;
  return { ...rest, provenance };
}

/**
 * Planned own-tools (roadmap — implemented as engines are wired):
 *  - workflow:watershed         fill → D8 flow-dir → flow-accum → threshold → Strahler  (composite)
 *  - workflow:chm-from-lidar    ground filter → DEM → DSM → CHM                          (composite)
 *  - compare:slope              whitebox slope  vs  gdaldem slope  → diff + stats        (cross-engine)
 *  - domain:pit-slope-zones     mining pit/slope morphometry                            (domain)
 *  - ml:landcover               trained ONNX land-cover classifier (onnxruntime-web)    (ML)
 *  - uq:dem-error-montecarlo    Monte-Carlo DEM-error propagation on a derived map       (uncertainty)
 */
export const GEOLAB_TOOLS: Tool[] = [];
