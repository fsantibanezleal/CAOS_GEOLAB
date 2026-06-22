import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import './styles.css';
import { App } from './App';
import { initTheme } from './store/theme';

initTheme();

const el = document.getElementById('root');
if (!el) throw new Error('GeoLab: #root not found');

createRoot(el).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
