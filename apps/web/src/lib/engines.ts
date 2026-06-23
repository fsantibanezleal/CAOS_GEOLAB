/**
 * The engine catalog — real data (dossier 05 §1) powering the Workbench engine panel + the Credits page +
 * the per-tool provenance chips. `approxTools` are honest estimates of how many tools each engine can
 * contribute; `status` reflects integration reality (not aspiration).
 */
export type EngineStatus = 'planned' | 'adapter-scaffold' | 'wired';

export interface EngineInfo {
  engine: string;
  project: string;
  authors: string;
  license: string;
  tier: 'permissive' | 'weak-copyleft' | 'strong-copyleft';
  url: string;
  approxTools: number;
  status: EngineStatus;
}

export const ENGINE_CATALOG: EngineInfo[] = [
  { engine: 'geolibre', project: 'WhiteboxTools / geolibre-rust', authors: 'J. Lindsay; opengeos (Q. Wu)', license: 'MIT', tier: 'permissive', url: 'https://github.com/opengeos/geolibre-rust', approxTools: 740, status: 'wired' },
  { engine: 'turf', project: 'Turf.js', authors: 'Turf.js contributors', license: 'MIT', tier: 'permissive', url: 'https://turfjs.org/', approxTools: 150, status: 'wired' },
  { engine: 'gdal', project: 'GDAL/OGR (gdal3.js)', authors: 'GDAL contributors; B. Sırmaçek', license: 'MIT', tier: 'permissive', url: 'https://github.com/bugra9/gdal3.js', approxTools: 50, status: 'planned' },
  { engine: 'geos', project: 'GEOS (geos-wasm)', authors: 'GEOS/JTS; C. Pahmeyer', license: 'LGPL-2.1', tier: 'weak-copyleft', url: 'https://github.com/chrispahm/geos-wasm', approxTools: 50, status: 'planned' },
  { engine: 'h3', project: 'Uber H3 (h3-js)', authors: 'Uber', license: 'Apache-2.0', tier: 'permissive', url: 'https://h3geo.org/', approxTools: 60, status: 'planned' },
  { engine: 'mapshaper', project: 'mapshaper', authors: 'M. Bloch', license: 'MPL-2.0', tier: 'weak-copyleft', url: 'https://github.com/mbloch/mapshaper', approxTools: 50, status: 'planned' },
  { engine: 'vips', project: 'libvips / wasm-vips', authors: 'J. Cupitt; K. A. Wolthuizen', license: 'LGPL-2.1+', tier: 'weak-copyleft', url: 'https://github.com/kleisauke/wasm-vips', approxTools: 300, status: 'planned' },
  { engine: 'itk', project: 'ITK-Wasm', authors: 'Insight Software Consortium', license: 'Apache-2.0', tier: 'permissive', url: 'https://github.com/InsightSoftwareConsortium/ITK-Wasm', approxTools: 200, status: 'planned' },
  { engine: 'onnx', project: 'ONNX Runtime Web', authors: 'Microsoft', license: 'MIT', tier: 'permissive', url: 'https://onnxruntime.ai/', approxTools: 10, status: 'planned' },
  { engine: 'geolab', project: 'GeoLab (own tools)', authors: 'F. Santibañez-Leal', license: 'MIT', tier: 'permissive', url: 'https://github.com/fsantibanezleal/CAOS_GEOLAB', approxTools: 12, status: 'planned' },
];

export const TOTAL_APPROX_TOOLS = ENGINE_CATALOG.reduce((n, e) => n + e.approxTools, 0);
