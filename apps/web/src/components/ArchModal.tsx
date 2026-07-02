import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { ARCH_TABS } from '../lib/architecture-tabs';

/** ADR-0058 — the in-app "How it works" modal: 5 themed-SVG tabs, each paired with a bilingual explanation. */
export function ArchModal({ onClose }: { onClose: () => void }) {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es';
  const [active, setActive] = useState(ARCH_TABS[0]!.id);
  const tab = ARCH_TABS.find((t) => t.id === active) ?? ARCH_TABS[0]!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="arch-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2 style={{ marginBottom: '.6rem' }}>GeoLab — {isEs ? 'Cómo funciona' : 'How it works'}</h2>

        <div className="arch-tabs" role="tablist">
          {ARCH_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active === t.id}
              className={`arch-tab${active === t.id ? ' on' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {isEs ? t.es : t.en}
            </button>
          ))}
        </div>

        <div className="arch-body">
          <div className="arch-figure" dangerouslySetInnerHTML={{ __html: tab.svg }} />
          <p className="arch-desc">{isEs ? tab.body_es : tab.body_en}</p>
        </div>
      </div>
    </div>
  );
}
