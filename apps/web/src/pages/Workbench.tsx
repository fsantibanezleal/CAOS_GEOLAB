import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { InMemoryFS, type Layer, type ParamSchema, type Tool } from '@geolab/tool-core';
import { loadGeolibreTools, getGeolibreManifest } from '../engines/geolibre';
import { readCogGrid, readCogBoundsLonLat } from '../engines/geolibre-io';
import { writeSyntheticDem } from '../lib/dem';
import type { Grid } from '../lib/grid';
import { CMAPS, type CmapName } from '../lib/colormap';
import { RasterCanvas } from '../components/RasterCanvas';
import { MapView } from '../components/MapView';
import { ParamForm } from '../components/ParamForm';
import { Toolbox } from '../components/Toolbox';
import { LayersPanel } from '../components/LayersPanel';
import { useWorkerRunner } from '../lib/useWorkerRunner';

interface WLayer {
  layer: Layer;
  grid: Grid;
  unit?: string;
  cmap: CmapName;
  lonLatBbox?: [number, number, number, number];
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
  const { state: workerState, progress, run: runInWorker, cancel } = useWorkerRunner();
  const running = workerState === 'running';

  const [tools, setTools] = useState<Tool[]>([]);
  const [engineLoading, setEngineLoading] = useState(false);
  const [wlayers, setWlayers] = useState<WLayer[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [query, setQuery] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'canvas' | 'map'>('canvas');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
      const lonLatBbox = await readCogBoundsLonLat(bytes) ?? undefined;
      addLayer({ layer: { id, name: 'Synthetic DEM (30 m, UTM 19S)', kind: 'raster', crs: 'EPSG:32719', format: 'GTiff', bytesRef: ref }, grid, unit: 'm', cmap: 'terrain', lonLatBbox });
      await ensureEngine();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function uploadFile(file: File) {
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const [grid, lonLatBbox] = await Promise.all([readCogGrid(bytes), readCogBoundsLonLat(bytes)]);
      const id = `up-${++idRef.current}`;
      const ref = `data/${id}.tif`;
      fsRef.current.set(ref, bytes);
      addLayer({ layer: { id, name: file.name, kind: 'raster', format: 'GeoTIFF', bytesRef: ref }, grid, cmap: 'viridis', lonLatBbox: lonLatBbox ?? undefined });
      await ensureEngine();
    } catch (e) {
      setError(`${file.name}: ${e instanceof Error ? e.message : String(e)} — is it a single-band GeoTIFF raster?`);
    }
  }

  function validateParams(schema: ParamSchema, values: Record<string, unknown>): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const [key, spec] of Object.entries(schema)) {
      if (spec.type === 'output' || spec.type === 'boolean') continue;
      const optional = 'optional' in spec && spec.optional;
      if (optional) continue;
      const v = values[key];
      if (v === undefined || v === null || v === '') {
        errs[key] = 'Required';
      }
    }
    return errs;
  }

  function selectTool(id: string) {
    setSelectedToolId(id);
    const tool = tools.find((tl) => tl.id === id);
    if (tool) setParams(defaultsFor(tool.params, firstRasterId(activeId ?? undefined)));
    setLog([]);
    setFormErrors({});
  }

  async function runSelected() {
    if (!selectedTool || running) return;
    setError(null);
    setLog([]);

    const errs = validateParams(selectedTool.params, params);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      setError('Fill in all required parameters before running.');
      return;
    }
    setFormErrors({});

    const manifest = getGeolibreManifest(selectedTool.id);
    if (!manifest) {
      // Fallback: run on main thread (non-geolibre tools, future adapters).
      setError(`No geolibre manifest found for "${selectedTool.id}" — main-thread fallback not implemented yet.`);
      return;
    }

    try {
      const result = await runInWorker(manifest, params, wlayers.map((w) => w.layer), fsRef.current);

      let firstOut: string | null = null;
      for (const out of result.outputs) {
        const id = `${selectedTool.id.replace(/[^a-z0-9]+/gi, '_')}-${++idRef.current}`;
        if (out.kind === 'raster') {
          const ref = `data/${id}.tif`;
          await fsRef.current.write(ref, out.bytes);
          const [grid, lonLatBbox] = await Promise.all([readCogGrid(out.bytes), readCogBoundsLonLat(out.bytes)]);
          const layer: Layer = {
            id,
            name: `${selectedTool.name} · ${out.name}`,
            kind: 'raster',
            format: out.format,
            bytesRef: ref,
            producedBy: [selectedTool.provenance],
          };
          setWlayers((prev) => [{ layer, grid, cmap: 'viridis', lonLatBbox: lonLatBbox ?? undefined }, ...prev]);
          if (!firstOut) firstOut = id;
        }
      }
      if (firstOut) setActiveId(firstOut);
      setLog(['exit 0', ...result.log]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'Cancelled') setError(msg);
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
            <div className="view-toggle">
              <button type="button" className={viewMode === 'canvas' ? 'vtab on' : 'vtab'} onClick={() => setViewMode('canvas')}>Grid</button>
              <button type="button" className={viewMode === 'map' ? 'vtab on' : 'vtab'} onClick={() => setViewMode('map')}>Map</button>
            </div>
            {viewMode === 'canvas' ? (
              active ? (
                <RasterCanvas grid={active.grid} colormap={CMAPS[active.cmap] ?? CMAPS.viridis!} unit={active.unit} decimals={1} title={active.layer.name} />
              ) : (
                <div className="map-note">{t('wb.canvasHint')}</div>
              )
            ) : (
              <MapView
                grid={active?.grid ?? null}
                colormap={CMAPS[active?.cmap ?? 'viridis'] ?? CMAPS.viridis!}
                lonLatBbox={active?.lonLatBbox ?? null}
                title={active?.layer.name}
              />
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
              <ParamForm
                schema={selectedTool.params}
                values={params}
                onChange={(k, v) => {
                  setParams((p) => ({ ...p, [k]: v }));
                  if (formErrors[k]) setFormErrors((e) => { const next = { ...e }; delete next[k]; return next; });
                }}
                layers={wlayers.map((w) => w.layer)}
                errors={formErrors}
              />

              <div className="run-actions">
                <button type="button" className="btn" onClick={runSelected} disabled={running}>
                  {running ? t('wb.running') : t('wb.runTool')}
                </button>
                {running && (
                  <button type="button" className="btn btn-cancel" onClick={cancel}>
                    {t('wb.cancel')}
                  </button>
                )}
              </div>

              {running && (
                <div className="run-progress-wrap">
                  <div className="run-progress-bar" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
                  {progress.message && <span className="run-progress-msg">{progress.message}</span>}
                </div>
              )}

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
        {t('wb.workerNote')} {t('wb.note')} <Link to="/tools">{t('nav.tools')}</Link> · <Link to="/credits">{t('nav.credits')}</Link>
      </p>
    </div>
  );
}
