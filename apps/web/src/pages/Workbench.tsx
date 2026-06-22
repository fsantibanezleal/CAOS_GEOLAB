import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { InMemoryFS, type Layer, type ParamSchema, type Tool, type ToolRunContext } from '@geolab/tool-core';
import { loadGeolibreTools } from '../engines/geolibre';
import { readCogGrid } from '../engines/geolibre-io';
import { writeSyntheticDem } from '../lib/dem';
import type { Grid } from '../lib/grid';
import { TERRAIN, VIRIDIS } from '../lib/colormap';
import { RasterCanvas } from '../components/RasterCanvas';
import { ParamForm } from '../components/ParamForm';

function defaultsFor(schema: ParamSchema, layerId: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, spec] of Object.entries(schema)) {
    if (spec.type === 'layer') out[k] = layerId;
    else if ('default' in spec && spec.default !== undefined) out[k] = spec.default;
  }
  return out;
}

export function Workbench() {
  const { t } = useTranslation();
  const fsRef = useRef(new InMemoryFS());

  const [demLayer, setDemLayer] = useState<Layer | null>(null);
  const [demGrid, setDemGrid] = useState<Grid | null>(null);
  const [slopeGrid, setSlopeGrid] = useState<Grid | null>(null);
  const [slopeTool, setSlopeTool] = useState<Tool | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [engineLoading, setEngineLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function generateDem() {
    setError(null);
    setLog([]);
    setSlopeGrid(null);
    const { bytes, grid } = await writeSyntheticDem();
    fsRef.current.set('in/dem.tif', bytes);
    const layer: Layer = {
      id: 'dem',
      name: 'Synthetic DEM (30 m, UTM 19S)',
      kind: 'raster',
      crs: 'EPSG:32719',
      format: 'GTiff',
      extent: [500000, 5992800, 507200, 6000000],
      bytesRef: 'in/dem.tif',
    };
    setDemLayer(layer);
    setDemGrid(grid);

    setEngineLoading(true);
    try {
      const tools = await loadGeolibreTools();
      const slope = tools.find((tool) => tool.id === 'geolibre:slope') ?? null;
      setSlopeTool(slope);
      if (slope) setParams(defaultsFor(slope.params, layer.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEngineLoading(false);
    }
  }

  async function runSlope() {
    if (!slopeTool || !demLayer) return;
    setRunning(true);
    setError(null);
    setLog([]);
    try {
      const ctx: ToolRunContext = {
        fs: fsRef.current,
        layer: (id) => (id === demLayer.id ? demLayer : undefined),
        signal: new AbortController().signal,
        onProgress: () => {},
      };
      const res = await slopeTool.run(ctx, params);
      const out = res.outputs.find((o) => o.kind === 'raster');
      if (out?.bytesRef) {
        const bytes = await fsRef.current.read(out.bytesRef);
        setSlopeGrid(await readCogGrid(bytes));
      }
      setLog(['exit 0', ...(res.log ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="wb">
      <section className="hero">
        <h1>{t('app.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
      </section>

      <div className="callout">
        <strong>{t('wb.introTitle')}</strong>
        <p>{t('wb.intro')}</p>
      </div>

      <div className="run-steps">
        <div className="step">
          <div className="step-h">
            <span className="step-n">1</span> {t('wb.step1')}
          </div>
          <button type="button" className="btn" onClick={generateDem} disabled={engineLoading || running}>
            {t('wb.gen')}
          </button>
        </div>

        {slopeTool && demLayer ? (
          <div className="step">
            <div className="step-h">
              <span className="step-n">2</span> {slopeTool.name} <span className="mono">{slopeTool.id}</span>
              <span className={`chip tier-${slopeTool.provenance.license.tier}`}>
                {slopeTool.provenance.upstreamProject.includes('Whitebox') ? 'WhiteboxTools' : 'GeoLibre'} ·{' '}
                {slopeTool.provenance.license.spdx}
              </span>
            </div>
            <ParamForm schema={slopeTool.params} values={params} onChange={(k, v) => setParams((p) => ({ ...p, [k]: v }))} layers={demLayer ? [demLayer] : []} />
            <button type="button" className="btn" onClick={runSlope} disabled={running}>
              {running ? t('wb.running') : t('wb.run')}
            </button>
          </div>
        ) : (
          engineLoading && <div className="callout">{t('wb.engineLoading')}</div>
        )}
      </div>

      {error && <div className="callout err">{error}</div>}

      <div className="raster-grid">
        {demGrid && <RasterCanvas grid={demGrid} colormap={TERRAIN} unit="m" decimals={0} title={t('wb.dem')} />}
        {slopeGrid && <RasterCanvas grid={slopeGrid} colormap={VIRIDIS} unit="°" decimals={1} title={t('wb.slope')} />}
      </div>

      {log.length > 0 && (
        <details className="log" open>
          <summary>{t('wb.log')}</summary>
          <pre>{log.join('\n')}</pre>
        </details>
      )}

      <p className="muted measure" style={{ marginTop: '1.5rem' }}>
        {t('wb.note')} <Link to="/tools">{t('nav.tools')}</Link> · <Link to="/credits">{t('nav.credits')}</Link>
      </p>
    </div>
  );
}
