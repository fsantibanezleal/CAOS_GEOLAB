import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Briefcase, Github, Globe, Info, Languages, Layers, Moon, Sun } from 'lucide-react';
import { ROUTES } from '../lib/routes';
import { EXTERNAL_LINKS } from '../lib/links';
import { useTheme } from '../store/theme';
import { ArchModal } from '../components/ArchModal';

export function Layout() {
  const { t, i18n } = useTranslation();
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const [arch, setArch] = useState(false);

  return (
    <>
      <header className="hdr">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <Layers size={20} />
          <span>GeoLab</span>
        </a>
        <nav className="nav">
          {ROUTES.map((r) => (
            <NavLink key={r.path} to={r.path} end={r.path === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
              {t(r.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="actions">
          <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={18} /></a>
          <a href={EXTERNAL_LINKS.personal} target="_blank" rel="noreferrer" aria-label="Personal site"><Globe size={18} /></a>
          <a href={EXTERNAL_LINKS.portfolio} target="_blank" rel="noreferrer" aria-label="Portfolio"><Briefcase size={18} /></a>
          <span className="sep" />
          <button type="button" onClick={() => void i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en')} title={t('lang.toggle')} aria-label={t('lang.toggle')}>
            <Languages size={18} />
          </button>
          <button type="button" onClick={toggleTheme} title={t('theme.toggle')} aria-label={t('theme.toggle')}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button type="button" onClick={() => setArch(true)} title={t('arch.open')} aria-label={t('arch.open')}>
            <Info size={18} />
          </button>
        </div>
      </header>

      <main className="page-body">
        <Outlet />
      </main>

      {/* Compact, to-the-point footer (ADR-0016 §2): brand + lab + author + single GitHub + license + version.
          The personal/portfolio links already live in the header, so they are NOT repeated here (focus error). */}
      <footer className="ftr">
        <span className="ftr-brand">GeoLab</span>
        <span aria-hidden="true">·</span>
        <span>{t('footer.lab')}</span>
        <span aria-hidden="true">·</span>
        <span>{t('footer.by')}</span>
        <span aria-hidden="true">·</span>
        <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer">GitHub</a>
        <span aria-hidden="true">·</span>
        <span>{t('footer.license')} · v0.18.000</span>
      </footer>

      {arch && <ArchModal onClose={() => setArch(false)} />}
    </>
  );
}
