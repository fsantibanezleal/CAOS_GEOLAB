/** Single source of truth for top-level routes (ADR-0016 §1 — router + nav both read this). */
export interface AppRoute {
  path: string;
  /** i18n key for the nav label. */
  labelKey: string;
}

export const ROUTES: AppRoute[] = [
  { path: '/', labelKey: 'nav.workbench' },
  { path: '/pipeline', labelKey: 'nav.pipeline' },
  { path: '/tools', labelKey: 'nav.tools' },
  { path: '/credits', labelKey: 'nav.credits' },
];
