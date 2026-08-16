import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Same-container default (plain `pnpm dev`, Codespaces). Docker Compose overrides
// these to each service's container name since they're separate containers there.
const oddsEngineTarget = process.env.ODDS_ENGINE_PROXY_TARGET ?? 'http://localhost:4001';
const backendTarget = process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:3000';

// Shared between the dev server and the production preview server (see
// Dockerfile - "vite preview" serves the built dist/ and needs the same
// proxy/host allowlist the dev server had).
const allowedHosts = ['.up.railway.app', 'betsome.pt', 'www.betsome.pt'];
const proxy = {
  '/api': {
    target: oddsEngineTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
  '/backend': {
    target: backendTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/backend/, ''),
  },
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest (rather than the default generateSW) is required to
      // add custom push/notificationclick service-worker listeners - see
      // src/sw.ts, which manually calls precacheAndRoute to preserve the
      // offline-caching behavior generateSW used to provide automatically.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Sportsbook',
        short_name: 'Sportsbook',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0f1a',
        theme_color: '#0b0f1a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    // Vite's dev server rejects unrecognized Host headers by default.
    allowedHosts,
    proxy,
  },
  preview: {
    // Production runs "vite preview" against the built dist/ (see
    // Dockerfile) rather than the dev server, so it needs its own port,
    // host allowlist and API proxy - mirrors the dev server config above.
    host: true,
    port: 5173,
    allowedHosts,
    proxy,
  },
});
