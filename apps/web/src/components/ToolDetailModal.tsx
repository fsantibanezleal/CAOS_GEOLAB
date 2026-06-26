import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { ParamSpec, Tool } from '@geolab/tool-core';
import { geolibreToolDoc } from '@geolab/adapter-geolibre';
import { SAMPLES } from '../lib/samples/registry';

type Tab = 'theory' | 'impl' | 'contract' | 'usage';

const CATEGORY_NOTE: Record<string, { en: string; es: string }> = {
  'terrain-morphometry': { en: 'Derives terrain form (slope, aspect, curvature, hillshade) from an elevation surface.', es: 'Deriva la forma del terreno (pendiente, orientación, curvatura, sombreado) desde una superficie de elevación.' },
  hydrology: { en: 'Models how water moves over a DEM — depressions, flow direction/accumulation, watersheds.', es: 'Modela cómo el agua fluye sobre un DEM — depresiones, dirección/acumulación de flujo, cuencas.' },
  'stream-network': { en: 'Extracts and analyses channel networks from a flow-accumulation raster.', es: 'Extrae y analiza redes de canales desde un raster de acumulación de flujo.' },
  'lidar-pointcloud': { en: 'Processes 3D LiDAR point clouds — filtering, classification, gridding to a surface.', es: 'Procesa nubes de puntos LiDAR 3D — filtrado, clasificación, interpolación a una superficie.' },
  'imagery-remote-sensing': { en: 'Operates on multi-band imagery — indices, enhancement, classification.', es: 'Opera sobre imágenes multibanda — índices, realce, clasificación.' },
  'vector-gis': { en: 'Classic vector GIS — overlays, buffers, geometry attributes, conversions.', es: 'GIS vectorial clásico — superposiciones, buffers, atributos de geometría, conversiones.' },
  'raster-math-stats': { en: 'Per-cell math, reclassification and statistics over raster grids.', es: 'Matemática por celda, reclasificación y estadística sobre grillas raster.' },
  'spatial-statistics': { en: 'Spatial statistics & geostatistics — interpolation, autocorrelation, variograms.', es: 'Estadística espacial y geoestadística — interpolación, autocorrelación, variogramas.' },
  'data-io': { en: 'Reads, writes and converts geospatial formats between representations.', es: 'Lee, escribe y convierte formatos geoespaciales entre representaciones.' },
  'projections-crs': { en: 'Reprojects data and manages coordinate reference systems.', es: 'Reproyecta datos y gestiona sistemas de referencia de coordenadas.' },
  'ml-segmentation': { en: 'Machine-learning segmentation & classification of geospatial data.', es: 'Segmentación y clasificación de datos geoespaciales con machine learning.' },
  'cartography-render': { en: 'Cartographic rendering and visual styling of layers.', es: 'Renderizado cartográfico y estilizado visual de capas.' },
  'workflow-composite': { en: 'Composite multi-step operations that chain several primitives.', es: 'Operaciones compuestas multi-paso que encadenan varias primitivas.' },
};

const KIND_LABEL: Record<string, { en: string; es: string; ext: string }> = {
  raster: { en: 'Raster (GeoTIFF / COG)', es: 'Raster (GeoTIFF / COG)', ext: '.tif' },
  vector: { en: 'Vector (GeoJSON)', es: 'Vector (GeoJSON)', ext: '.geojson' },
  pointcloud: { en: 'Point cloud (LAS)', es: 'Nube de puntos (LAS)', ext: '.las' },
  table: { en: 'Table (CSV)', es: 'Tabla (CSV)', ext: '.csv' },
  text: { en: 'Text / HTML', es: 'Texto / HTML', ext: '.txt' },
  scalar: { en: 'Scalar value', es: 'Valor escalar', ext: '' },
};

function widgetType(spec: ParamSpec, isEs: boolean): string {
  switch (spec.type) {
    case 'layer': return (isEs ? 'capa ' : 'layer ') + spec.accepts.join('/');
    case 'field': return isEs ? 'campo de atributo' : 'attribute field';
    case 'enum': return isEs ? 'opción' : 'option';
    case 'boolean': return isEs ? 'sí/no' : 'boolean';
    case 'integer': return isEs ? 'entero' : 'integer';
    case 'number': return isEs ? 'número' : 'number';
    case 'crs': return 'CRS';
    case 'extent': return isEs ? 'extensión' : 'extent';
    case 'file': return isEs ? 'archivo' : 'file';
    case 'output': return isEs ? 'salida' : 'output';
    default: return isEs ? 'texto' : 'text';
  }
}

export function ToolDetailModal({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  void t;
  const isEs = i18n.language === 'es';
  const [tab, setTab] = useState<Tab>('theory');
  const doc = geolibreToolDoc(tool.id);
  const bareId = tool.id.replace(/^geolibre:/, '');
  const prov = tool.provenance;
  const isWasm = prov.engine === 'geolibre';

  const inputParams = Object.entries(tool.params).filter(([, s]) => s.type !== 'output');
  const outputParams = Object.entries(tool.params).filter(([, s]) => s.type === 'output');
  const inputKinds = [...new Set(tool.inputs)];
  const matchingSamples = SAMPLES.filter((s) => inputKinds.includes(s.kind));
  const outExt = KIND_LABEL[tool.outputs[0] ?? 'raster']?.ext || '.tif';

  const TABS: { key: Tab; en: string; es: string }[] = [
    { key: 'theory', en: 'Theory', es: 'Teoría' },
    { key: 'impl', en: 'Implementation', es: 'Implementación' },
    { key: 'contract', en: 'Data contract', es: 'Contrato de datos' },
    { key: 'usage', en: 'Usage', es: 'Uso' },
  ];

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="tool-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="tool-modal-head">
          <h2>{tool.name}</h2>
          <div className="tool-modal-id mono">{tool.id}</div>
          <div className="tool-modal-chips">
            <span className={`chip tier-${prov.license.tier}`}>{prov.upstreamProject.includes('Whitebox') ? 'WhiteboxTools' : 'GeoLibre'} · {prov.license.spdx}</span>
            <span className="chip">{tool.category}</span>
            <span className="chip">v{tool.version}</span>
          </div>
        </div>

        <div className="arch-tabs" role="tablist">
          {TABS.map(({ key, en, es }) => (
            <button key={key} role="tab" type="button" aria-selected={tab === key}
              className={`arch-tab${tab === key ? ' on' : ''}`} onClick={() => setTab(key)}>
              {isEs ? es : en}
            </button>
          ))}
        </div>

        <div className="tool-modal-body">
          {tab === 'theory' && (
            <div>
              <p className="tm-lead">{doc?.description || tool.summary}</p>
              {CATEGORY_NOTE[tool.category] && (
                <p className="tm-note">{isEs ? CATEGORY_NOTE[tool.category]!.es : CATEGORY_NOTE[tool.category]!.en}</p>
              )}
              <dl className="tm-dl">
                <dt>{isEs ? 'Categoría' : 'Category'}</dt><dd>{tool.category}{doc?.toolbox ? ` · ${doc.toolbox}` : ''}</dd>
                <dt>{isEs ? 'Proyecto' : 'Upstream'}</dt><dd>{prov.upstreamProject}</dd>
                <dt>{isEs ? 'Autores' : 'Authors'}</dt><dd>{prov.authors}</dd>
                {prov.citation && (<><dt>{isEs ? 'Cita' : 'Citation'}</dt><dd>{prov.citation}</dd></>)}
              </dl>
              <a className="tm-link" href={prov.url} target="_blank" rel="noreferrer">{isEs ? 'Documentación original ↗' : 'Upstream documentation ↗'}</a>
            </div>
          )}

          {tab === 'impl' && (
            <div>
              <dl className="tm-dl">
                <dt>{isEs ? 'Motor' : 'Engine'}</dt><dd>{prov.engine} · {prov.upstreamProject}</dd>
                <dt>{isEs ? 'Ejecución' : 'Runtime'}</dt>
                <dd>{isWasm ? (isEs ? 'WebAssembly (WASI) en un Web Worker — UI responsiva' : 'WebAssembly (WASI) in a Web Worker — UI stays responsive') : (isEs ? 'JavaScript, hilo principal' : 'JavaScript, main thread')}</dd>
                <dt>{isEs ? 'Licencia' : 'License'}</dt><dd>{prov.license.spdx} ({prov.license.tier})</dd>
                <dt>{isEs ? 'Versión' : 'Version'}</dt><dd>{prov.version ?? tool.version}</dd>
              </dl>
              <div className="tm-sub">{isEs ? 'Invocación (cliente):' : 'Invocation (client-side):'}</div>
              <pre className="tm-code">{isWasm
                ? `runTool('${bareId}', {\n  args: [${[...inputParams.map(([k]) => `'--${k}=…'`), ...outputParams.map(([k]) => `'--${k}=/work/out${outExt}'`)].join(', ')}],\n  input: { /* your bytes under /work */ },\n})`
                : `tool.run(ctx, { ${inputParams.map(([k]) => k).join(', ')} })`}</pre>
              <div className="tm-io">
                <span className="chip">in: {inputKinds.length ? inputKinds.join(', ') : '—'}</span>
                <span className="chip">out: {[...new Set(tool.outputs)].join(', ') || '—'}</span>
              </div>
            </div>
          )}

          {tab === 'contract' && (
            <div>
              <div className="tm-sub">{isEs ? 'Parámetros de entrada' : 'Input parameters'}</div>
              {inputParams.length === 0 ? (
                <p className="tm-note">{isEs ? 'Sin parámetros — corre directamente.' : 'No parameters — runs directly.'}</p>
              ) : (
                <table className="tm-table">
                  <thead><tr><th>{isEs ? 'Nombre' : 'Name'}</th><th>{isEs ? 'Tipo' : 'Type'}</th><th>{isEs ? 'Req.' : 'Req.'}</th><th>{isEs ? 'Por defecto' : 'Default'}</th></tr></thead>
                  <tbody>
                    {inputParams.map(([key, spec]) => {
                      const required = spec.type !== 'boolean' && !('optional' in spec && spec.optional);
                      const def = 'default' in spec && spec.default !== undefined ? String(spec.default) : '—';
                      const pdoc = doc?.params.find((p) => p.flag === `--${key}` || p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === key.replace(/[^a-z0-9]/g, ''));
                      return (
                        <tr key={key}>
                          <td><span className="mono">--{key}</span>{pdoc?.description ? <div className="tm-pdesc">{pdoc.description}</div> : null}</td>
                          <td>{widgetType(spec, isEs)}</td>
                          <td>{required ? '✓' : '—'}</td>
                          <td className="mono">{def}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="tm-sub">{isEs ? 'Salidas' : 'Outputs'}</div>
              <ul className="tm-out">
                {outputParams.length === 0 ? <li className="tm-note">{isEs ? '(según la herramienta)' : '(tool-dependent)'}</li> :
                  outputParams.map(([key, spec]) => (
                    <li key={key}><span className="mono">--{key}</span> → {spec.type === 'output' ? (KIND_LABEL[spec.kind] ? (isEs ? KIND_LABEL[spec.kind]!.es : KIND_LABEL[spec.kind]!.en) : spec.kind) : ''}</li>
                  ))}
              </ul>
            </div>
          )}

          {tab === 'usage' && (
            <div>
              <div className="tm-sub">{isEs ? 'Cómo correrla en GeoLab' : 'How to run it in GeoLab'}</div>
              <ol className="tm-steps">
                <li>{isEs ? 'Abre el ' : 'Open the '}<strong>{isEs ? 'Banco de trabajo' : 'Workbench'}</strong>.</li>
                <li>
                  {matchingSamples.length > 0
                    ? (isEs ? 'Carga una muestra compatible: ' : 'Load a matching sample: ') + matchingSamples.slice(0, 4).map((s) => s.name).join(' · ')
                    : (isEs ? 'Genera o sube una capa de entrada.' : 'Generate or upload an input layer.')}
                </li>
                <li>{isEs ? 'Busca ' : 'Search for '}<span className="mono">{bareId}</span>{isEs ? ' en el toolbox y selecciónala.' : ' in the toolbox and select it.'}</li>
                <li>{isEs ? 'Completa el formulario (capa, campo, parámetros) y pulsa ' : 'Fill the form (layer, field, parameters) and click '}<strong>{isEs ? 'Correr herramienta' : 'Run tool'}</strong>.</li>
                <li>{isEs ? 'El resultado aparece como una capa nueva — descárgala con ↓.' : 'The result appears as a new layer — download it with ↓.'}</li>
              </ol>
              {inputKinds.length > 0 && (
                <p className="tm-note">{isEs ? 'Entrada esperada: ' : 'Expected input: '}{inputKinds.map((k) => KIND_LABEL[k] ? (isEs ? KIND_LABEL[k]!.es : KIND_LABEL[k]!.en) : k).join(', ')}.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
