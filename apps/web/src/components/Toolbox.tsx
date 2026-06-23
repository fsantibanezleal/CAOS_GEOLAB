import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tool } from '@geolab/tool-core';

interface Props {
  tools: Tool[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
}

/** The toolbox: all loaded tools grouped by category, searchable (a tool runs on the active layer). */
export function Toolbox({ tools, selectedId, onSelect, query, onQuery }: Props) {
  const { t } = useTranslation();
  const groups = useMemo(() => {
    const ql = query.trim().toLowerCase();
    const filtered = ql
      ? tools.filter((tool) => [tool.id, tool.name, tool.summary, ...(tool.tags ?? [])].some((s) => s.toLowerCase().includes(ql)))
      : tools;
    const m = new Map<string, Tool[]>();
    for (const tool of filtered) {
      const a = m.get(tool.category) ?? [];
      a.push(tool);
      m.set(tool.category, a);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tools, query]);

  return (
    <div className="toolbox panel">
      <h3>
        {t('toolbox.title')} <span className="muted">· {tools.length}</span>
      </h3>
      <input className="search" placeholder={t('toolbox.search')} value={query} onChange={(e) => onQuery(e.target.value)} />
      <div className="tbx-scroll">
        {groups.map(([cat, list]) => (
          <details key={cat} open={query.trim().length > 0}>
            <summary>
              {cat} <span className="muted">· {list.length}</span>
            </summary>
            <ul>
              {list.map((tool) => (
                <li
                  key={tool.id}
                  className={tool.id === selectedId ? 'sel' : ''}
                  title={tool.summary}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(tool.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelect(tool.id);
                  }}
                >
                  {tool.name}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
