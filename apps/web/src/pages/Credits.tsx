import { useTranslation } from 'react-i18next';
import { ENGINE_CATALOG } from '../lib/engines';

export function Credits() {
  const { t } = useTranslation();
  return (
    <div className="credits">
      <h1>{t('credits.title')}</h1>
      <p className="measure">{t('credits.intro')}</p>
      <table className="tbl">
        <thead>
          <tr>
            <th>{t('col.engine')}</th>
            <th>{t('col.project')}</th>
            <th>{t('col.authors')}</th>
            <th>{t('col.license')}</th>
            <th>{t('col.tools')}</th>
            <th>{t('col.status')}</th>
          </tr>
        </thead>
        <tbody>
          {ENGINE_CATALOG.map((e) => (
            <tr key={e.engine}>
              <td className="mono">{e.engine}</td>
              <td><a href={e.url} target="_blank" rel="noreferrer">{e.project}</a></td>
              <td>{e.authors}</td>
              <td><span className={`chip tier-${e.tier}`}>{e.license}</span></td>
              <td>{e.approxTools}</td>
              <td><span className={`chip st-${e.status}`}>{e.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
