import { useState } from 'react';
import { X } from 'lucide-react';
import { ENGINE_CATALOG } from '../lib/engines';

type Tab = 'overview' | 'engines' | 'dataflow' | 'privacy';

export function ArchModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [isEs, setIsEs] = useState(() => document.documentElement.lang === 'es');

  // Detect language from i18n without importing the hook (avoids re-render issues)
  // Read from html[lang] set by the language toggle; fallback: check localStorage
  const lang = isEs ? 'es' : 'en';
  void lang; // suppress unused

  // Sync language on mount via attribute observer is overkill — use i18n state
  // We'll just read from localStorage key 'i18nextLng' as a lightweight check
  useState(() => {
    const saved = localStorage.getItem('i18nextLng');
    if (saved === 'es') setIsEs(true);
  });

  const TABS: { key: Tab; en: string; es: string }[] = [
    { key: 'overview', en: 'Architecture', es: 'Arquitectura' },
    { key: 'engines', en: 'Engines', es: 'Motores' },
    { key: 'dataflow', en: 'Data Flow', es: 'Flujo de datos' },
    { key: 'privacy', en: 'Privacy', es: 'Privacidad' },
  ];

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="arch-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2 style={{ marginBottom: '.6rem' }}>
          GeoLab — {isEs ? 'Cómo funciona' : 'How it works'}
        </h2>

        <div className="arch-tabs" role="tablist">
          {TABS.map(({ key, en, es }) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              className={`arch-tab${tab === key ? ' on' : ''}`}
              onClick={() => setTab(key)}
            >
              {isEs ? es : en}
            </button>
          ))}
        </div>

        <div className="arch-body">
          {tab === 'overview' && <OverviewTab isEs={isEs} />}
          {tab === 'engines' && <EnginesTab isEs={isEs} />}
          {tab === 'dataflow' && <DataFlowTab isEs={isEs} />}
          {tab === 'privacy' && <PrivacyTab isEs={isEs} />}
        </div>
      </div>
    </div>
  );
}

// ─── CSS variable references for SVG style attributes ────────────────────────
const v = {
  fg: 'var(--fg)',
  sub: 'var(--fg-subtle)',
  accent: 'var(--accent)',
  soft: 'var(--accent-soft)',
  border: 'var(--border)',
  surf: 'var(--surface-2)',
  good: 'var(--good)',
  bad: 'var(--bad)',
};

function Arr({ id }: { id: string }) {
  return (
    <marker id={id} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <path d="M0,0 L7,3.5 L0,7 Z" style={{ fill: v.sub }} />
    </marker>
  );
}

// ─── Tab 1: Platform architecture overview ───────────────────────────────────
function OverviewTab({ isEs }: { isEs: boolean }) {
  return (
    <div>
      <p className="arch-desc">
        {isEs
          ? 'GeoLab es una plataforma multi-motor de análisis geoespacial que corre enteramente en el navegador. Un Registro de Herramientas unificado conecta la UI con adaptadores de motores intercambiables.'
          : 'GeoLab is a multi-engine geospatial analysis platform that runs entirely in the browser. A unified Tool Registry connects the UI to swappable engine adapters.'}
      </p>
      <svg viewBox="0 0 620 320" style={{ width: '100%', maxHeight: 320, display: 'block' }}>
        <defs><Arr id="ao" /></defs>

        {/* Browser boundary */}
        <rect x="6" y="6" width="608" height="308" rx="12"
          strokeWidth="1.5" strokeDasharray="6,3"
          style={{ fill: 'none', stroke: v.border }} />
        <text x="18" y="24" style={{ fill: v.sub, fontSize: '11px' }}>
          {isEs ? '🌐 Navegador — tu máquina' : '🌐 Browser — your machine'}
        </text>

        {/* Workbench */}
        <rect x="28" y="34" width="168" height="50" rx="8" strokeWidth="1.5"
          style={{ fill: v.soft, stroke: v.accent }} />
        <text x="112" y="55" textAnchor="middle" style={{ fill: v.fg, fontSize: '12px', fontWeight: 600 }}>
          {isEs ? 'Banco de trabajo' : 'Workbench'}
        </text>
        <text x="112" y="73" textAnchor="middle" style={{ fill: v.sub, fontSize: '10px' }}>
          {isEs ? 'analizar · capas · mapa' : 'analyse · layers · map'}
        </text>

        {/* Pipeline */}
        <rect x="212" y="34" width="168" height="50" rx="8" strokeWidth="1.5"
          style={{ fill: v.soft, stroke: v.accent }} />
        <text x="296" y="55" textAnchor="middle" style={{ fill: v.fg, fontSize: '12px', fontWeight: 600 }}>
          {isEs ? 'Editor de Pipeline' : 'Pipeline Editor'}
        </text>
        <text x="296" y="73" textAnchor="middle" style={{ fill: v.sub, fontSize: '10px' }}>
          {isEs ? 'DAG · receta · cadena' : 'DAG · recipe · chain'}
        </text>

        {/* connectors from UIs → registry */}
        <line x1="112" y1="84" x2="112" y2="114" strokeWidth="1.5" style={{ stroke: v.border }} />
        <line x1="296" y1="84" x2="296" y2="114" strokeWidth="1.5" style={{ stroke: v.border }} />
        <line x1="112" y1="114" x2="296" y2="114" strokeWidth="1.5" style={{ stroke: v.border }} />
        <line x1="204" y1="114" x2="204" y2="130" strokeWidth="1.5" markerEnd="url(#ao)" style={{ stroke: v.border }} />

        {/* Tool Registry */}
        <rect x="126" y="130" width="156" height="46" rx="8" strokeWidth="1.5"
          style={{ fill: v.surf, stroke: v.border }} />
        <text x="204" y="149" textAnchor="middle" style={{ fill: v.fg, fontSize: '12px', fontWeight: 600 }}>
          {isEs ? 'Registro de Herramientas' : 'Tool Registry'}
        </text>
        <text x="204" y="165" textAnchor="middle" style={{ fill: v.sub, fontSize: '10px' }}>
          {isEs ? 'catálogo · procedencia' : 'catalog · provenance · search'}
        </text>

        {/* fan-out from registry → engines */}
        <line x1="204" y1="176" x2="204" y2="202" strokeWidth="1.5" style={{ stroke: v.border }} />
        <line x1="70" y1="202" x2="486" y2="202" strokeWidth="1.5" style={{ stroke: v.border }} />

        {/* geolibre arrow */}
        <line x1="70" y1="202" x2="70" y2="218" strokeWidth="1.5" markerEnd="url(#ao)" style={{ stroke: v.border }} />
        {/* turf arrow */}
        <line x1="204" y1="202" x2="204" y2="218" strokeWidth="1.5" markerEnd="url(#ao)" style={{ stroke: v.border }} />
        {/* h3 arrow */}
        <line x1="345" y1="202" x2="345" y2="218" strokeWidth="1.5" markerEnd="url(#ao)" style={{ stroke: v.border }} />
        {/* planned arrow (dashed) */}
        <line x1="486" y1="202" x2="486" y2="218" strokeWidth="1.5" strokeDasharray="4,2" markerEnd="url(#ao)"
          style={{ stroke: v.sub }} />

        {/* geolibre box */}
        <rect x="14" y="218" width="112" height="78" rx="8" strokeWidth="1.5"
          style={{ fill: v.surf, stroke: v.border }} />
        <text x="70" y="236" textAnchor="middle" style={{ fill: v.accent, fontSize: '11px', fontWeight: 700 }}>geolibre</text>
        <text x="70" y="252" textAnchor="middle" style={{ fill: v.sub, fontSize: '9.5px' }}>
          {isEs ? '~747 herramientas' : '~747 tools'}
        </text>
        <text x="70" y="268" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>WASM · Web Worker</text>
        <text x="70" y="284" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>raster · terrain</text>

        {/* turf box */}
        <rect x="148" y="218" width="112" height="78" rx="8" strokeWidth="1.5"
          style={{ fill: v.surf, stroke: v.border }} />
        <text x="204" y="236" textAnchor="middle" style={{ fill: v.accent, fontSize: '11px', fontWeight: 700 }}>Turf.js</text>
        <text x="204" y="252" textAnchor="middle" style={{ fill: v.sub, fontSize: '9.5px' }}>
          {isEs ? '16 herramientas' : '16 tools'}
        </text>
        <text x="204" y="268" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>JS · main thread</text>
        <text x="204" y="284" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>vector ops</text>

        {/* h3 box */}
        <rect x="289" y="218" width="112" height="78" rx="8" strokeWidth="1.5"
          style={{ fill: v.surf, stroke: v.border }} />
        <text x="345" y="236" textAnchor="middle" style={{ fill: v.accent, fontSize: '11px', fontWeight: 700 }}>H3 (Uber)</text>
        <text x="345" y="252" textAnchor="middle" style={{ fill: v.sub, fontSize: '9.5px' }}>
          {isEs ? '8 herramientas' : '8 tools'}
        </text>
        <text x="345" y="268" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>JS · main thread</text>
        <text x="345" y="284" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>hex indexing</text>

        {/* planned box */}
        <rect x="422" y="218" width="128" height="78" rx="8" strokeWidth="1" strokeDasharray="4,2"
          style={{ fill: v.surf, stroke: v.sub }} />
        <text x="486" y="236" textAnchor="middle" style={{ fill: v.sub, fontSize: '10px', fontWeight: 700 }}>
          {isEs ? '+ más motores' : '+ more engines'}
        </text>
        <text x="486" y="252" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>GDAL · GEOS</text>
        <text x="486" y="268" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>mapshaper · libvips</text>
        <text x="486" y="284" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>
          {isEs ? '(planificado)' : '(planned)'}
        </text>

        {/* Your files box */}
        <rect x="418" y="34" width="178" height="50" rx="8" strokeWidth="1.5"
          style={{ fill: v.surf, stroke: v.border }} />
        <text x="507" y="55" textAnchor="middle" style={{ fill: v.fg, fontSize: '11px', fontWeight: 600 }}>
          {isEs ? 'Tus archivos' : 'Your files'}
        </text>
        <text x="507" y="73" textAnchor="middle" style={{ fill: v.sub, fontSize: '9.5px' }}>
          {isEs ? 'GeoTIFF · GeoJSON · sin subir' : 'GeoTIFF · GeoJSON · never uploaded'}
        </text>

        {/* arrow from files to workbench area */}
        <line x1="418" y1="59" x2="200" y2="59" strokeWidth="1.5" strokeDasharray="3,2"
          markerEnd="url(#ao)" style={{ stroke: v.border }} />
      </svg>
    </div>
  );
}

// ─── Tab 2: Engine roster ────────────────────────────────────────────────────
function EnginesTab({ isEs }: { isEs: boolean }) {
  const wired = ENGINE_CATALOG.filter((e) => e.status === 'wired');
  const planned = ENGINE_CATALOG.filter((e) => e.status !== 'wired');

  return (
    <div>
      <p className="arch-desc">
        {isEs
          ? 'Cada motor aporta herramientas especializadas a través de un adaptador estandarizado. Los tres motores cableados funcionan hoy; los planificados se conectarán sin cambios en la UI.'
          : 'Each engine contributes specialised tools through a standardised adapter interface. The three wired engines work today; planned engines will plug in without UI changes.'}
      </p>

      <div className="arch-engine-grid">
        {wired.map((e) => (
          <div key={e.engine} className="arch-engine-card arch-engine-card--wired">
            <div className="arch-engine-name">{e.engine}</div>
            <div className="arch-engine-project">{e.project}</div>
            <div className="arch-engine-meta">
              <span className="chip tier-permissive">{e.license}</span>
              <span className="chip st-wired">
                {isEs ? '✓ activo' : '✓ wired'}
              </span>
            </div>
            <div className="arch-engine-tools">
              {e.approxTools.toLocaleString()} {isEs ? 'herramientas' : 'tools'}
            </div>
          </div>
        ))}
      </div>

      <div className="arch-planned-label">
        {isEs ? 'En la hoja de ruta:' : 'On the roadmap:'}
      </div>
      <div className="arch-engine-planned-list">
        {planned.map((e) => (
          <span key={e.engine} className="arch-engine-planned-chip">
            {e.engine}
            <span className="arch-planned-tools">
              {' '}≈{e.approxTools}
            </span>
          </span>
        ))}
      </div>

      <svg viewBox="0 0 620 160" style={{ width: '100%', maxHeight: 160, display: 'block', marginTop: '1rem' }}>
        <defs><Arr id="ae" /></defs>

        {/* Adapter interface diagram */}
        <text x="310" y="18" textAnchor="middle" style={{ fill: v.sub, fontSize: '11px' }}>
          {isEs ? 'Interfaz del adaptador (idéntica para todos los motores)' : 'Adapter interface (identical across all engines)'}
        </text>

        {/* Tool Registry */}
        <rect x="230" y="28" width="160" height="36" rx="8" strokeWidth="1.5"
          style={{ fill: v.surf, stroke: v.border }} />
        <text x="310" y="50" textAnchor="middle" style={{ fill: v.fg, fontSize: '11px', fontWeight: 600 }}>
          {isEs ? 'Registro de Herramientas' : 'Tool Registry'}
        </text>

        {/* arrows down from registry */}
        <line x1="310" y1="64" x2="310" y2="82" strokeWidth="1.5" style={{ stroke: v.border }} />
        <line x1="100" y1="82" x2="520" y2="82" strokeWidth="1.5" style={{ stroke: v.border }} />
        <line x1="100" y1="82" x2="100" y2="96" strokeWidth="1.5" markerEnd="url(#ae)" style={{ stroke: v.border }} />
        <line x1="310" y1="82" x2="310" y2="96" strokeWidth="1.5" markerEnd="url(#ae)" style={{ stroke: v.border }} />
        <line x1="520" y1="82" x2="520" y2="96" strokeWidth="1.5" markerEnd="url(#ae)" style={{ stroke: v.border }} />

        {/* adapter boxes — each has buildTools(engine) → Tool[] */}
        {[
          { x: 26, label: 'adapter-geolibre', sub: isEs ? 'WASM + Worker' : 'WASM + Worker' },
          { x: 222, label: 'adapter-turf', sub: 'JS main thread' },
          { x: 418, label: 'adapter-h3', sub: 'JS main thread' },
        ].map(({ x, label, sub }) => (
          <g key={label}>
            <rect x={x} y={96} width={154} height={48} rx="7" strokeWidth="1.5"
              style={{ fill: v.soft, stroke: v.accent }} />
            <text x={x + 77} y={116} textAnchor="middle"
              style={{ fill: v.fg, fontSize: '10px', fontWeight: 600 }}>{label}</text>
            <text x={x + 77} y={132} textAnchor="middle"
              style={{ fill: v.sub, fontSize: '9.5px' }}>{sub}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Tab 3: Data flow for one tool run ──────────────────────────────────────
function DataFlowTab({ isEs }: { isEs: boolean }) {
  const steps = isEs
    ? [
        { icon: '📂', label: 'Tu archivo', sub: 'GeoTIFF\nGeoJSON' },
        { icon: '💾', label: 'FS virtual', sub: 'InMemoryFS\n(Blob URLs)' },
        { icon: '⚙️', label: 'Adaptador', sub: 'collectRunArgs\nauto-form' },
        { icon: '🔧', label: 'Motor', sub: 'WASM Worker\no JS thread' },
        { icon: '📤', label: 'Salida', sub: 'bytes →\ndecode' },
        { icon: '🗺️', label: 'Nueva capa', sub: 'raster/vector\nWorkspace' },
      ]
    : [
        { icon: '📂', label: 'Your file', sub: 'GeoTIFF\nGeoJSON' },
        { icon: '💾', label: 'Virtual FS', sub: 'InMemoryFS\n(Blob URLs)' },
        { icon: '⚙️', label: 'Adapter', sub: 'collectRunArgs\nauto-form' },
        { icon: '🔧', label: 'Engine', sub: 'WASM Worker\nor JS thread' },
        { icon: '📤', label: 'Output', sub: 'bytes →\ndecode' },
        { icon: '🗺️', label: 'New layer', sub: 'raster/vector\nWorkspace' },
      ];

  const W = 620;
  const boxW = 78;
  const boxH = 80;
  const gap = (W - steps.length * boxW) / (steps.length + 1);
  const y0 = 30;

  return (
    <div>
      <p className="arch-desc">
        {isEs
          ? 'Cuando el usuario ejecuta una herramienta, los datos fluyen enteramente dentro del navegador: desde el archivo en memoria hasta la nueva capa renderizada. Nada se envía a un servidor.'
          : 'When the user runs a tool, data flows entirely inside the browser — from the in-memory file to the rendered output layer. Nothing is sent to a server.'}
      </p>
      <svg viewBox={`0 0 ${W} ${y0 + boxH + 30}`}
        style={{ width: '100%', maxHeight: y0 + boxH + 30, display: 'block' }}>
        <defs><Arr id="adf" /></defs>
        {steps.map((s, i) => {
          const x = gap + i * (boxW + gap);
          const cx = x + boxW / 2;
          const subLines = s.sub.split('\n');
          return (
            <g key={i}>
              {/* box */}
              <rect x={x} y={y0} width={boxW} height={boxH} rx="8" strokeWidth="1.5"
                style={{ fill: v.surf, stroke: i < 3 ? v.border : i === 3 ? v.accent : v.border }} />
              {/* emoji */}
              <text x={cx} y={y0 + 22} textAnchor="middle" style={{ fontSize: '16px' }}>{s.icon}</text>
              {/* label */}
              <text x={cx} y={y0 + 40} textAnchor="middle"
                style={{ fill: v.fg, fontSize: '10px', fontWeight: 600 }}>{s.label}</text>
              {/* sub-text */}
              {subLines.map((l, li) => (
                <text key={li} x={cx} y={y0 + 55 + li * 13} textAnchor="middle"
                  style={{ fill: v.sub, fontSize: '8.5px' }}>{l}</text>
              ))}
              {/* arrow to next */}
              {i < steps.length - 1 && (
                <line
                  x1={x + boxW + 2} y1={y0 + boxH / 2}
                  x2={x + boxW + gap - 2} y2={y0 + boxH / 2}
                  strokeWidth="1.5" markerEnd="url(#adf)"
                  style={{ stroke: v.border }}
                />
              )}
            </g>
          );
        })}
        {/* bottom note */}
        <text x={W / 2} y={y0 + boxH + 22} textAnchor="middle"
          style={{ fill: v.sub, fontSize: '10px' }}>
          {isEs
            ? '← Todo dentro del navegador. Tu VFS se vacía al recargar la página. →'
            : '← Everything inside the browser. Your VFS is cleared on page reload. →'}
        </text>
      </svg>

      <div className="arch-flow-detail">
        <div className="arch-flow-row">
          <span className="arch-flow-key">
            {isEs ? 'Herramienta WASM (geolibre):' : 'WASM tool (geolibre):'}
          </span>
          <span className="arch-flow-val">
            {isEs
              ? 'args + bytes → postMessage → Web Worker → geolibre-wasm.runTool() → output bytes → postMessage back'
              : 'args + bytes → postMessage → Web Worker → geolibre-wasm.runTool() → output bytes → postMessage back'}
          </span>
        </div>
        <div className="arch-flow-row">
          <span className="arch-flow-key">
            {isEs ? 'Herramienta JS (Turf / H3):' : 'JS tool (Turf / H3):'}
          </span>
          <span className="arch-flow-val">
            {isEs
              ? 'collectRunArgs() → tool.run(ctx, params) → main thread → GeoJSON/text output'
              : 'collectRunArgs() → tool.run(ctx, params) → main thread → GeoJSON / text output'}
          </span>
        </div>
        <div className="arch-flow-row">
          <span className="arch-flow-key">
            {isEs ? 'Renderizado raster:' : 'Raster render:'}
          </span>
          <span className="arch-flow-val">
            {isEs
              ? 'COG → geolibre reader → Float32Array → colormap → canvas / MapLibre ImageSource'
              : 'COG → geolibre reader → Float32Array → colormap → canvas / MapLibre ImageSource'}
          </span>
        </div>
        <div className="arch-flow-row">
          <span className="arch-flow-key">
            {isEs ? 'Renderizado vector:' : 'Vector render:'}
          </span>
          <span className="arch-flow-val">
            {isEs
              ? 'GeoJSON bytes → parseGeoJSON() → MapLibre GeoJSONSource → fill/line/circle layers'
              : 'GeoJSON bytes → parseGeoJSON() → MapLibre GeoJSONSource → fill / line / circle layers'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Privacy guarantee ────────────────────────────────────────────────
function PrivacyTab({ isEs }: { isEs: boolean }) {
  return (
    <div>
      <p className="arch-desc">
        {isEs
          ? 'GeoLab no tiene backend. Tus archivos de datos geoespaciales viven exclusivamente en la memoria del navegador mientras la página está abierta, y se eliminan al recargar.'
          : 'GeoLab has no backend. Your geospatial data files live exclusively in browser memory while the page is open, and are cleared on reload.'}
      </p>

      <svg viewBox="0 0 620 240" style={{ width: '100%', maxHeight: 240, display: 'block' }}>
        <defs>
          <Arr id="apr" />
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" strokeWidth="1.5" style={{ stroke: v.border }} />
          </pattern>
        </defs>

        {/* Browser boundary */}
        <rect x="6" y="6" width="440" height="228" rx="12" strokeWidth="1.5" strokeDasharray="6,3"
          style={{ fill: 'none', stroke: v.border }} />
        <text x="18" y="24" style={{ fill: v.sub, fontSize: '11px' }}>
          {isEs ? '🌐 Navegador — tu máquina' : '🌐 Browser — your machine'}
        </text>

        {/* In-memory VFS */}
        <rect x="28" y="36" width="200" height="60" rx="8" strokeWidth="1.5"
          style={{ fill: v.soft, stroke: v.accent }} />
        <text x="128" y="57" textAnchor="middle" style={{ fill: v.fg, fontSize: '11px', fontWeight: 600 }}>
          {isEs ? 'Tus datos (en memoria)' : 'Your data (in memory)'}
        </text>
        <text x="128" y="73" textAnchor="middle" style={{ fill: v.sub, fontSize: '9.5px' }}>
          {isEs ? 'GeoTIFF · GeoJSON · capas · resultados' : 'GeoTIFF · GeoJSON · layers · results'}
        </text>
        <text x="128" y="87" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>
          {isEs ? '(se borra al recargar)' : '(cleared on page reload)'}
        </text>

        {/* WASM engines */}
        <rect x="28" y="118" width="200" height="50" rx="8" strokeWidth="1.5"
          style={{ fill: v.surf, stroke: v.border }} />
        <text x="128" y="139" textAnchor="middle" style={{ fill: v.fg, fontSize: '11px', fontWeight: 600 }}>
          {isEs ? 'Motores WASM / JS' : 'WASM / JS Engines'}
        </text>
        <text x="128" y="155" textAnchor="middle" style={{ fill: v.sub, fontSize: '9.5px' }}>
          {isEs ? 'geolibre · Turf.js · H3 (Uber)' : 'geolibre · Turf.js · H3 (Uber)'}
        </text>

        {/* arrow data → engines */}
        <line x1="128" y1="96" x2="128" y2="118" strokeWidth="1.5" markerEnd="url(#apr)" style={{ stroke: v.border }} />

        {/* Result */}
        <rect x="250" y="118" width="175" height="50" rx="8" strokeWidth="1.5"
          style={{ fill: v.surf, stroke: v.border }} />
        <text x="337" y="139" textAnchor="middle" style={{ fill: v.fg, fontSize: '11px', fontWeight: 600 }}>
          {isEs ? 'Capas de salida' : 'Output layers'}
        </text>
        <text x="337" y="155" textAnchor="middle" style={{ fill: v.sub, fontSize: '9.5px' }}>
          {isEs ? 'raster · vector · texto' : 'raster · vector · text'}
        </text>

        {/* arrow engines → result */}
        <line x1="228" y1="143" x2="250" y2="143" strokeWidth="1.5" markerEnd="url(#apr)" style={{ stroke: v.border }} />

        {/* MapLibre (reads tiles from CDN) */}
        <rect x="250" y="36" width="175" height="60" rx="8" strokeWidth="1.5"
          style={{ fill: v.surf, stroke: v.border }} />
        <text x="337" y="57" textAnchor="middle" style={{ fill: v.fg, fontSize: '11px', fontWeight: 600 }}>MapLibre GL JS</text>
        <text x="337" y="73" textAnchor="middle" style={{ fill: v.sub, fontSize: '9.5px' }}>
          {isEs ? 'mapa de fondo (teselas)' : 'basemap tiles (CDN)'}
        </text>
        <text x="337" y="87" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>
          {isEs ? 'solo coordenadas de vista' : 'view coordinates only'}
        </text>

        {/* No-server zone (right of browser) */}
        <rect x="458" y="6" width="156" height="228" rx="12" strokeWidth="1.5"
          style={{ fill: 'none', stroke: v.bad, strokeDasharray: '5,3' }} />
        <text x="536" y="24" textAnchor="middle" style={{ fill: v.bad, fontSize: '11px', fontWeight: 600 }}>
          {isEs ? '🚫 Sin servidor' : '🚫 No server'}
        </text>

        {/* Blocked arrows (thick red X style) */}
        <line x1="446" y1="90" x2="458" y2="90" strokeWidth="1.5" strokeDasharray="4,2"
          style={{ stroke: v.bad }} />
        <text x="530" y="56" textAnchor="middle" style={{ fill: v.bad, fontSize: '10px' }}>
          {isEs ? 'tus datos\nnunca salen' : 'your data'}
        </text>
        <text x="530" y="70" textAnchor="middle" style={{ fill: v.bad, fontSize: '10px' }}>
          {isEs ? '' : 'never leaves'}
        </text>
        <text x="530" y="85" textAnchor="middle" style={{ fill: v.bad, fontSize: '22px' }}>✗</text>

        {/* What IS sent */}
        <text x="536" y="114" textAnchor="middle" style={{ fill: v.sub, fontSize: '10px', fontWeight: 600 }}>
          {isEs ? '¿Qué SÍ sale?' : 'What IS sent?'}
        </text>
        <text x="536" y="132" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>
          {isEs ? '· WASM desde npm CDN' : '· WASM from npm CDN'}
        </text>
        <text x="536" y="147" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>
          {isEs ? '  (carga inicial)' : '  (first load only)'}
        </text>
        <text x="536" y="162" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>
          {isEs ? '· Teselas del mapa' : '· Map tile requests'}
        </text>
        <text x="536" y="177" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>
          {isEs ? '  (coords. de vista)' : '  (view coords only)'}
        </text>
        <text x="536" y="192" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>
          {isEs ? '· Sin analytics' : '· No analytics'}
        </text>
        <text x="536" y="207" textAnchor="middle" style={{ fill: v.sub, fontSize: '9px' }}>
          {isEs ? '· Sin cookies' : '· No cookies'}
        </text>
      </svg>

      <div className="arch-privacy-note">
        <strong>{isEs ? 'Garantía:' : 'Guarantee:'}</strong>
        {' '}
        {isEs
          ? 'GeoLab no envía tus archivos a ningún servidor. No hay backend de procesamiento, no hay base de datos de usuarios, no hay telemetría. El análisis ocurre completamente en tu dispositivo usando WASM y JS del lado del cliente.'
          : 'GeoLab never sends your files to any server. There is no processing backend, no user database, no telemetry. Analysis happens entirely on your device using client-side WASM and JS.'}
      </div>
    </div>
  );
}
