# Credits & third-party engines

GeoLab is a thin, didactic platform over a large body of open-source geospatial work. **Every tool in the
app shows its source** (a provenance chip: engine · authors · license · version) and links here. We do not
claim authorship of integrated engines — only of GeoLab itself and the tools under `packages/geolab-tools`.

## Compute engines integrated (or planned)

| Engine | Upstream project | Authors | License | Tier | Link |
|---|---|---|---|---|---|
| geolibre | WhiteboxTools / whitebox_next_gen / geolibre-rust | John Lindsay; opengeos (Qiusheng Wu) | MIT | permissive | https://github.com/opengeos/geolibre-rust |
| gdal | GDAL/OGR via gdal3.js | GDAL contributors; Buğra Sırmaçek | MIT/X11 | permissive | https://github.com/bugra9/gdal3.js |
| geos | GEOS via geos-wasm | GEOS/JTS contributors; Christoph Pahmeyer | LGPL-2.1 | weak-copyleft | https://github.com/chrispahm/geos-wasm |
| turf | Turf.js | Turf.js contributors | MIT | permissive | https://turfjs.org/ |
| h3 | Uber H3 (h3-js) | Uber Technologies | Apache-2.0 | permissive | https://h3geo.org/ |
| mapshaper | mapshaper | Matthew Bloch | MPL-2.0 | weak-copyleft | https://github.com/mbloch/mapshaper |
| itk | ITK-Wasm | Insight Software Consortium | Apache-2.0 | permissive | https://github.com/InsightSoftwareConsortium/ITK-Wasm |
| vips | libvips / wasm-vips | John Cupitt; Kleis Auke Wolthuizen | LGPL-2.1+ | weak-copyleft | https://github.com/kleisauke/wasm-vips |
| opencv | OpenCV.js | OpenCV contributors | Apache-2.0 | permissive | https://opencv.org/ |
| onnx | ONNX Runtime Web | Microsoft | MIT | permissive | https://onnxruntime.ai/ |
| proj4 | proj4js | proj4js contributors | MIT | permissive | http://proj4js.org/ |
| geotiff | geotiff.js / geoblaze | GeoTIFF.js + GeoBlaze contributors | MIT | permissive | https://geotiffjs.github.io/ |

## Visualization & UI

| Library | License | Link |
|---|---|---|
| MapLibre GL JS | BSD-3-Clause | https://maplibre.org/ |
| deck.gl | MIT | https://deck.gl/ |
| Potree | BSD | https://github.com/potree/potree |
| React Flow (xyflow) | MIT | https://reactflow.dev/ |
| KaTeX | MIT | https://katex.org/ |
| lucide | ISC | https://lucide.dev/ |

## Strong-copyleft engines (handled with care)

GeoLab's core is **MIT**. Strong-copyleft (GPL) engines are **never linked into the core**. If integrated,
they ship as **separate, optional, lazily-loaded modules** with an explicit license notice:

| Engine | Upstream | License | Handling |
|---|---|---|---|
| jsgeoda / GeoDaLib | GeoDa (GeoDaCenter, Xun Li / Luc Anselin) | GPL-3.0 | optional module, segregated; or replaced by an MIT spatial-stats implementation |

Weak-copyleft (LGPL/MPL) engines (GEOS, libvips, mapshaper) are used as **separate WASM/JS modules**
(dynamic linking), with attribution preserved — compatible with an MIT application.

_If we have miscredited or mislicensed anything, it is an error to be fixed — open an issue._
