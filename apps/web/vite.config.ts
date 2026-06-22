import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path: "/" in dev and on a custom domain; "/CAOS_GEOLAB/" on a GitHub Pages project site.
// Set via VITE_BASE_URL (see .env.example) or the --base build flag.
const base = process.env.VITE_BASE_URL ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
