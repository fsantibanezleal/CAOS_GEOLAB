import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolRegistry, type Tool } from '@geolab/tool-core';
import { loadGeolibreTools } from '../engines/geolibre';
import { ToolDetailModal } from '../components/ToolDetailModal';

const PAGE_SIZE = 30;

export function Tools() {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Tool | null>(null);

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

  // Search filter (applies before the category split).
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return tools;
    return tools.filter((t0) => [t0.id, t0.name, t0.summary, ...(t0.tags ?? [])].some((s) => s.toLowerCase().includes(ql)));
  }, [tools, q]);

  // Category → count, sorted, for the tab strip.
  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const t0 of filtered) m.set(t0.category, (m.get(t0.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // Tools shown for the active category (or all), paginated.
  const inCat = useMemo(
    () => (cat === 'all' ? filtered : filtered.filter((t0) => t0.category === cat)),
    [filtered, cat],
  );
  const pageCount = Math.max(1, Math.ceil(inCat.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = inCat.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function pick(nextCat: string) {
    setCat(nextCat);
    setPage(0);
  }

  return (
    <div className="tools">
      <h1>{t('tools.title')}</h1>
      <p className="measure">{t('tools.intro')}</p>

      {tools.length === 0 ? (
        <button type="button" className="btn" onClick={load} disabled={loading}>
          {loading ? t('tools.loading') : t('tools.load')}
        </button>
      ) : (
        <>
          <div className="tools-head">
            <span><strong>{tools.length}</strong> {t('tools.loaded')}</span>
            <input
              className="search"
              placeholder={t('tools.search')}
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
            />
          </div>

          {/* category tabs */}
          <div className="cat-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={cat === 'all'} className={`cat-tab${cat === 'all' ? ' on' : ''}`} onClick={() => pick('all')}>
              {t('tools.allCats')} <span className="muted">· {filtered.length}</span>
            </button>
            {categories.map(([c, n]) => (
              <button key={c} type="button" role="tab" aria-selected={cat === c} className={`cat-tab${cat === c ? ' on' : ''}`} onClick={() => pick(c)}>
                {c} <span className="muted">· {n}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {err && <div className="callout err">{err}</div>}

      {tools.length > 0 && (
        <>
          <ul className="tool-list">
            {shown.map((tool) => {
              const src = tool.provenance.upstreamProject.includes('Whitebox') ? 'WhiteboxTools' : 'GeoLibre';
              return (
                <li key={tool.id} className="tool-card" role="button" tabIndex={0}
                  onClick={() => setDetail(tool)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(tool); } }}>
                  <div className="tool-name">{tool.name}</div>
                  <div className="tool-id mono">{tool.id}</div>
                  <div className="tool-sum">{tool.summary}</div>
                  <div className="tool-card-foot">
                    <span className={`chip tier-${tool.provenance.license.tier}`}>{src} · {tool.provenance.license.spdx}</span>
                    <span className="tool-more">{t('tools.details')} →</span>
                  </div>
                </li>
              );
            })}
          </ul>

          {inCat.length === 0 && <p className="measure muted">{t('tools.noMatch')}</p>}

          {pageCount > 1 && (
            <div className="pager">
              <button type="button" className="btn btn-ghost" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>← {t('tools.prev')}</button>
              <span className="pager-info">{t('tools.page')} {safePage + 1} / {pageCount} <span className="muted">· {inCat.length}</span></span>
              <button type="button" className="btn btn-ghost" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>{t('tools.next')} →</button>
            </div>
          )}
        </>
      )}

      {detail && <ToolDetailModal tool={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
