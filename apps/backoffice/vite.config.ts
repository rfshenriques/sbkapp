import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Same-container default (plain `pnpm dev`, Codespaces). Docker Compose
// overrides this to the backend's service name since it's a separate
// container there. Same proxy pattern as apps/frontend - keeps the browser
// same-origin with the backend so the staff refresh cookie just works, no
// CORS/credentials dance needed.
const backendTarget = process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:3000';
const oddsEngineTarget = process.env.ODDS_ENGINE_PROXY_TARGET ?? 'http://localhost:4001';

// Deliberately no custom domain - stays on Railway's auto-generated
// *.up.railway.app URL. A custom domain would get its own publicly logged
// TLS certificate (Certificate Transparency), making this staff tool
// trivially discoverable; the random Railway hostname isn't. Shared
// between the dev server and the production preview server (see
// Dockerfile - "vite preview" serves the built dist/ and needs the same
// proxy/host allowlist the dev server had).
const allowedHosts = ['.up.railway.app'];
const proxy = {
  '/backend': {
    target: backendTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/backend/, ''),
  },
  '/api': {
    target: oddsEngineTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({
  // Not served behind a shared reverse proxy - base stays "/" in every
  // environment, so VITE_BASE_PATH is unused. (An earlier draft split
  // staff/master backoffice by URL path under one shared domain via nginx -
  // see infra/nginx/betsome.me.conf - superseded; each app now runs as its
  // own standalone Railway service.)
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Distinct from apps/frontend's 5173 so both can run side by side on a bare host.
    port: 5174,
    allowedHosts,
    proxy,
  },
  preview: {
    // Production runs "vite preview" against the built dist/ (see
    // Dockerfile) rather than the dev server, so it needs its own port,
    // host allowlist and API proxy - mirrors the dev server config above.
    host: true,
    port: 5174,
    allowedHosts,
    proxy,
  },
});
