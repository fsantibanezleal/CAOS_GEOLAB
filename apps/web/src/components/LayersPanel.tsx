import { useTranslation } from 'react-i18next';
import type { Layer } from '@geolab/tool-core';

interface Props {
  layers: Layer[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onRemove: (id: string) => void;
}

/** The workspace layers (sample DEM, uploads, tool outputs). Click to render; × to remove. */
export function LayersPanel({ layers, activeId, onActivate, onRemove }: Props) {
  const { t } = useTranslation();
  return (
    <div className="layers panel">
      <h3>{t('layers.title')}</h3>
      {layers.length === 0 ? (
        <p className="muted">{t('layers.none')}</p>
      ) : (
        <ul className="layer-list">
          {layers.map((l) => (
            <li
              key={l.id}
              className={l.id === activeId ? 'sel' : ''}
              role="button"
              tabIndex={0}
              onClick={() => onActivate(l.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onActivate(l.id);
              }}
            >
              <span className="ln">{l.name}</span>
              <span className="lk chip">{l.kind}</span>
              <button
                type="button"
                className="lx"
                aria-label={`remove ${l.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(l.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
