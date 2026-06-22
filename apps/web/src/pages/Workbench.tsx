import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { InMemoryFS, type Layer, type ParamSchema, type Tool, type ToolRunContext } from '@geolab/tool-core';
import { loadGeolibreTools } from '../engines/geolibre';
import { readCogGrid } from '../engines/geolibre-io';
import { writeSyntheticDem } from '../lib/dem';
import type { Grid } from '../lib/grid';
import { CMAPS, type CmapName } from '../lib/colormap';
import { RasterCanvas } from '../components/RasterCanvas';
import { ParamForm } from '../components/ParamForm';
import { Toolbox } from '../components/Toolbox';
import { LayersPanel } from '../components/LayersPanel';

interface WLayer {
  layer: Layer;
  grid: Grid;
  unit?: string;
  cmap: CmapName;
}

function defaultsFor(schema: ParamSchema, rasterLayerId: string | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, spec] of Object.entries(schema)) {
    if (spec.type === 'layer' && spec.accepts.includes('raster') && rasterLayerId) out[k] = rasterLayerId;
    else if ('default' in spec && spec.default !== undefined) out[k] = spec.default;
  }
  return out;
}

export function Workbench() {
  const { t } = useTranslation();
  const fsRef = useRef(new InMemoryFS());
  const idRef = useRef(0);

  const [tools, setTools] = useState<Tool[]>([]);
  const [engineLoading, setEngineLoading] = useState(false);
  const [wlayers, setWlayers] = useState<WLayer[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const active = wlayers.find((w) => w.layer.id === activeId) ?? null;
  const selectedTool = tools.find((tl) => tl.id === selectedToolId) ?? null;
  const firstRasterId = (over?: string) => over ?? wlayers.find((w) => w.layer.kind === 'raster')?.layer.id;

  async function ensureEngine() {
    if (tools.length) return tools;
    setEngineLoading(true);
    try {
      const loaded = await loadGeolibreTools();
      setTools(loaded);
      return loaded;
    } finally {
      setEngineLoading(false);
    }
  }

  function addLayer(w: WLayer) {
    setWlayers((prev) => [w, ...prev]);
    setActiveId(w.layer.id);
  }

  async function generateDem() {
    setError(null);
    try {
      const { bytes, grid } = await writeSyntheticDem();
      const id = `dem-${++idRef.current}`;
      const ref = `data/${id}.tif`;
      fsRef.current.set(ref, bytes);
      addLayer({ layer: { id, name: 'Synthetic DEM (30 m, UTM 19S)', kind: 'raster', crs: 'EPSG:32719', format: 'GTiff', bytesRef: ref }, grid, unit: 'm', cmap: 'terrain' });
      await ensureEngine();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function uploadFile(file: File) {
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const grid = await readCogGrid(bytes); // throws if not a readable raster
      const id = `up-${++idRef.current}`;
      const ref = `data/${id}.tif`;
      fsRef.current.set(ref, bytes);
      addLayer({ layer: { id, name: file.name, kind: 'raster', format: 'GeoTIFF', bytesRef: ref }, grid, cmap: 'viridis' });
      await ensureEngine();
    } catch (e) {
      setError(`${file.name}: ${e instanceof Error ? e.message : String(e)} — is it a single-band GeoTIFF raster?`);
    }
  }

  function selectTool(id: string) {
    setSelectedToolId(id);
    const tool = tools.find((tl) => tl.id === id);
    if (tool) setParams(defaultsFor(tool.params, firstRasterId(activeId ?? undefined)));
    setLog([]);
  }

  async function runSelected() {
    if (!selectedTool) return;
    setRunning(true);
    setError(null);
    setLog([]);
    try {
      const ctx: ToolRunContext = {
        fs: fsRef.current,
        layer: (lid) => wlayers.find((w) => w.layer.id === lid)?.layer,
        signal: new AbortController().signal,
        onProgress: () => {},
      };
      const res = await selectedTool.run(ctx, params);
      let firstOut: string | null = null;
      for (const out of res.outputs) {
        if (!out.bytesRef) continue;
        const id = `${selectedTool.id.replace(/[^a-z0-9]+/gi, '_')}-${++idRef.current}`;
        if (out.kind === 'raster') {
          const grid = await readCogGrid(await fsRef.current.read(out.bytesRef));
          fsRef.current.set(`data/${id}.tif`, await fsRef.current.read(out.bytesRef));
          const layer: Layer = { id, name: `${selectedTool.name} · ${out.name}`, kind: 'raster', format: out.format, bytesRef: `data/${id}.tif`, producedBy: [selectedTool.provenance] };
          setWlayers((prev) => [{ layer, grid, cmap: 'viridis' }, ...prev]);
          if (!firstOut) firstOut = id;
        }
      }
      if (firstOut) setActiveId(firstOut);
      setLog(['exit 0', ...(res.log ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function setActiveCmap(cmap: CmapName) {
    setWlayers((prev) => prev.map((w) => (w.layer.id === activeId ? { ...w, cmap } : w)));
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

      <div className="wb-toolbar">
        <button type="button" className="btn" onClick={generateDem} disabled={running}>
          {t('wb.gen')}
        </button>
        <label className="btn btn-ghost">
          {t('wb.upload')}
          <input type="file" accept=".tif,.tiff" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.target.value = ''; }} />
        </label>
        {active && (
          <label className="cmap-pick">
            {t('wb.colormap')}
            <select value={active.cmap} onChange={(e) => setActiveCmap(e.target.value as CmapName)}>
              {Object.keys(CMAPS).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        {engineLoading && <span className="muted">{t('wb.engineLoading')}</span>}
      </div>

      {error && <div className="callout err">{error}</div>}

      <div className="wb-cols">
        {tools.length > 0 ? (
          <Toolbox tools={tools} selectedId={selectedToolId} onSelect={selectTool} query={query} onQuery={setQuery} />
        ) : (
          <div className="toolbox panel"><p className="muted">{t('wb.toolboxHint')}</p></div>
        )}

        <div className="wb-center">
          <div className="panel canvas-wrap">
            {active ? (
              <RasterCanvas grid={active.grid} colormap={CMAPS[active.cmap] ?? CMAPS.viridis!} unit={active.unit} decimals={1} title={active.layer.name} />
            ) : (
              <div className="map-note">{t('wb.canvasHint')}</div>
            )}
          </div>
          <LayersPanel
            layers={wlayers.map((w) => w.layer)}
            activeId={activeId}
            onActivate={setActiveId}
            onRemove={(id) => {
              setWlayers((prev) => prev.filter((w) => w.layer.id !== id));
              if (activeId === id) setActiveId(null);
            }}
          />
        </div>

        <div className="wb-right panel">
          {selectedTool ? (
            <>
              <div className="step-h">
                {selectedTool.name} <span className="mono">{selectedTool.id}</span>
                <span className={`chip tier-${selectedTool.provenance.license.tier}`}>
                  {selectedTool.provenance.upstreamProject.includes('Whitebox') ? 'WhiteboxTools' : 'GeoLibre'} · {selectedTool.provenance.license.spdx}
                </span>
              </div>
              <p className="tool-sum">{selectedTool.summary}</p>
              <ParamForm schema={selectedTool.params} values={params} onChange={(k, v) => setParams((p) => ({ ...p, [k]: v }))} layers={wlayers.map((w) => w.layer)} />
              <button type="button" className="btn" onClick={runSelected} disabled={running}>
                {running ? t('wb.running') : t('wb.runTool')}
              </button>
              {log.length > 0 && (
                <details className="log" open>
                  <summary>{t('wb.log')}</summary>
                  <pre>{log.join('\n')}</pre>
                </details>
              )}
            </>
          ) : (
            <p className="muted">{t('wb.pickTool')}</p>
          )}
        </div>
      </div>

      <p className="muted measure" style={{ marginTop: '1.5rem' }}>
        {t('wb.note')} <Link to="/tools">{t('nav.tools')}</Link> · <Link to="/credits">{t('nav.credits')}</Link>
      </p>
    </div>
  );
}
