import { useTranslation } from 'react-i18next';
import { ENGINE_CATALOG, TOTAL_APPROX_TOOLS } from '../lib/engines';

export function Workbench() {
  const { t } = useTranslation();
  return (
    <div className="wb">
      <section className="hero">
        <h1>{t('app.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
      </section>

      <div className="callout">
        <strong>{t('scaffold.title')}</strong>
        <p>{t('scaffold.body')}</p>
      </div>

      <div className="wb-grid">
        <section className="panel map-ph">
          <div className="map-note">{t('workbench.mapPlaceholder')}</div>
        </section>

        <section className="panel">
          <h2>
            {t('workbench.engines')} · ~{TOTAL_APPROX_TOOLS.toLocaleString()} {t('workbench.toolsApprox')}
          </h2>
          <ul className="engine-list">
            {ENGINE_CATALOG.map((e) => (
              <li key={e.engine}>
                <a href={e.url} target="_blank" rel="noreferrer" className="eng-name">{e.project}</a>
                <span className={`chip tier-${e.tier}`}>{e.license}</span>
                <span className="eng-tools">~{e.approxTools}</span>
                <span className={`chip st-${e.status}`}>{e.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
