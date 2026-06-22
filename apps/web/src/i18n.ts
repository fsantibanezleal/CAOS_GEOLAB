import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// EN-default, NO navigator auto-detect (ADR-0011 / ADR-0016).
const en = {
  'app.title': 'GeoLab',
  'app.tagline': 'Browser-native geospatial tools — your data never leaves your machine.',
  'nav.workbench': 'Workbench',
  'nav.tools': 'Tools',
  'nav.credits': 'Credits',
  'tools.title': 'Tool catalog',
  'tools.intro':
    'Load the geolibre engine (~22 MB WASM, runs entirely in your browser) to list its 747 real WhiteboxTools + GeoLibre tools, grouped by category, each with its provenance and license. More engines (Turf, GDAL, GEOS, H3, …) plug in next via their own adapters.',
  'tools.load': 'Load engine — 747 tools',
  'tools.loading': 'Loading WASM engine…',
  'tools.loaded': 'tools loaded in your browser',
  'tools.search': 'Search tools…',
  'scaffold.title': 'Early build (v0.02.000) — the geolibre engine runs live on the Tools page',
  'scaffold.body':
    'Architecture is in place (ADR-0059): a multi-engine tool registry with per-tool provenance. Engine adapters, the live map and the pipeline editor are landing next. Below is the engine catalog GeoLab integrates.',
  'workbench.engines': 'Integrated engines',
  'workbench.toolsApprox': '≈ tools',
  'workbench.status': 'status',
  'workbench.mapPlaceholder': 'The interactive map / 3D canvas lands here (MapLibre + deck.gl + Potree).',
  'credits.title': 'Credits & licenses',
  'credits.intro':
    'GeoLab stands on open-source work. Every tool shows its source; here is the full list. We claim authorship only of GeoLab and its own tools.',
  'col.engine': 'Engine',
  'col.project': 'Upstream project',
  'col.authors': 'Authors',
  'col.license': 'License',
  'col.tools': '≈ Tools',
  'col.status': 'Status',
  'footer.by': 'A CAOS research investigation by Felipe Santibañez-Leal',
  'footer.license': 'MIT',
  'theme.toggle': 'Toggle theme',
  'lang.toggle': 'Español',
  'arch.open': 'How it works',
};

const es: typeof en = {
  'app.title': 'GeoLab',
  'app.tagline': 'Herramientas geoespaciales en el navegador — tus datos nunca salen de tu equipo.',
  'nav.workbench': 'Banco de trabajo',
  'nav.tools': 'Herramientas',
  'nav.credits': 'Créditos',
  'tools.title': 'Catálogo de herramientas',
  'tools.intro':
    'Carga el motor geolibre (~22 MB WASM, corre completo en tu navegador) para listar sus 747 herramientas reales de WhiteboxTools + GeoLibre, agrupadas por categoría, cada una con su procedencia y licencia. Más motores (Turf, GDAL, GEOS, H3, …) se enchufan luego con sus propios adaptadores.',
  'tools.load': 'Cargar motor — 747 herramientas',
  'tools.loading': 'Cargando motor WASM…',
  'tools.loaded': 'herramientas cargadas en tu navegador',
  'tools.search': 'Buscar herramientas…',
  'scaffold.title': 'Versión temprana (v0.02.000) — el motor geolibre corre en vivo en la página Herramientas',
  'scaffold.body':
    'La arquitectura ya está (ADR-0059): un registro multi-motor con procedencia por herramienta. Los adaptadores de motores, el mapa en vivo y el editor de pipelines vienen a continuación. Abajo, el catálogo de motores que GeoLab integra.',
  'workbench.engines': 'Motores integrados',
  'workbench.toolsApprox': '≈ herramientas',
  'workbench.status': 'estado',
  'workbench.mapPlaceholder': 'Aquí va el mapa / canvas 3D interactivo (MapLibre + deck.gl + Potree).',
  'credits.title': 'Créditos y licencias',
  'credits.intro':
    'GeoLab se apoya en trabajo open-source. Cada herramienta muestra su origen; aquí está la lista completa. Solo reclamamos autoría de GeoLab y sus herramientas propias.',
  'col.engine': 'Motor',
  'col.project': 'Proyecto original',
  'col.authors': 'Autores',
  'col.license': 'Licencia',
  'col.tools': '≈ Herramientas',
  'col.status': 'Estado',
  'footer.by': 'Una investigación CAOS de Felipe Santibañez-Leal',
  'footer.license': 'MIT',
  'theme.toggle': 'Cambiar tema',
  'lang.toggle': 'English',
  'arch.open': 'Cómo funciona',
};

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
