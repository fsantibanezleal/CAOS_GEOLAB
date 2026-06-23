import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path: "/" in dev and on a custom domain; "/CAOS_GEOLAB/" on a GitHub Pages project site.
// Set via VITE_BASE_URL (see .env.example) or the --base build flag.
const base = process.env.VITE_BASE_URL ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  // geolibre-wasm ships a big WASI .wasm it resolves via import.meta.url — let Vite treat it as an asset
  // (don't pre-bundle), so the URL resolves and the engine loads on demand. Same applies inside the worker.
  optimizeDeps: { exclude: ['geolibre-wasm'] },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  // The geolibre worker uses dynamic import() (code-splitting), so it must be bundled as ES modules.
  worker: {
    format: 'es',
  },
});
