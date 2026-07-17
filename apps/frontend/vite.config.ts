import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Same-container default (plain `pnpm dev`, Codespaces). Docker Compose overrides
// these to each service's container name since they're separate containers there.
const oddsEngineTarget = process.env.ODDS_ENGINE_PROXY_TARGET ?? 'http://localhost:4001';
const backendTarget = process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sportsbook',
        short_name: 'Sportsbook',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b0f1a',
        theme_color: '#0b0f1a',
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: oddsEngineTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/backend': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
    },
  },
});
