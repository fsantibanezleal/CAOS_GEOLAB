import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolRegistry, type Tool } from '@geolab/tool-core';
import { loadGeolibreTools } from '../engines/geolibre';

export function Tools() {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const loaded = await loadGeolibreTools();
      const reg = new ToolRegistry();
      reg.registerAll(loaded);
      setTools(reg.list());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const byCategory = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const filtered = ql
      ? tools.filter((t0) => [t0.id, t0.name, t0.summary, ...(t0.tags ?? [])].some((s) => s.toLowerCase().includes(ql)))
      : tools;
    const map = new Map<string, Tool[]>();
    for (const t0 of filtered) {
      const arr = map.get(t0.category) ?? [];
      arr.push(t0);
      map.set(t0.category, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tools, q]);

  return (
    <div className="tools">
      <h1>{t('tools.title')}</h1>
      <p className="measure">{t('tools.intro')}</p>

      {tools.length === 0 ? (
        <button type="button" className="btn" onClick={load} disabled={loading}>
          {loading ? t('tools.loading') : t('tools.load')}
        </button>
      ) : (
        <div className="tools-head">
          <span>
            <strong>{tools.length}</strong> {t('tools.loaded')}
          </span>
          <input className="search" placeholder={t('tools.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {err && <div className="callout err">{err}</div>}

      {byCategory.map(([cat, list]) => (
        <section key={cat} className="cat">
          <h2>
            {cat} <span className="muted">· {list.length}</span>
          </h2>
          <ul className="tool-list">
            {list.map((tool) => {
              const src = tool.provenance.upstreamProject.includes('Whitebox') ? 'WhiteboxTools' : 'GeoLibre';
              return (
                <li key={tool.id}>
                  <div className="tool-name">
                    {tool.name} <span className="mono">{tool.id}</span>
                  </div>
                  <div className="tool-sum">{tool.summary}</div>
                  <span className={`chip tier-${tool.provenance.license.tier}`}>
                    {src} · {tool.provenance.license.spdx}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
