import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Same-container default (plain `pnpm dev`, Codespaces). Docker Compose
// overrides this to the backend's service name since it's a separate
// container there. Same proxy pattern as apps/backoffice - keeps the
// browser same-origin with the backend so the master refresh cookie just
// works, no CORS/credentials dance needed.
const backendTarget = process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  // Own subdomain (super.betsome.me), not a path behind a shared reverse
  // proxy - base stays "/" in every environment, so VITE_BASE_PATH is
  // unused. (An earlier draft split staff/master backoffice by URL path
  // under one betsome.me domain via nginx - see infra/nginx/betsome.me.conf
  // - superseded in favor of two subdomains, each mapped straight to its
  // own Railway service via CNAME: no extra reverse-proxy service to run.)
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Distinct from apps/frontend's 5173 and apps/backoffice's 5174 so all three can run side by side on a bare host.
    port: 5175,
    // Vite's dev server rejects requests with an unrecognized Host header by
    // default (only localhost out of the box) - without this, Railway's
    // generated *.up.railway.app domain (and this app's real subdomain) get
    // a blocked-request error instead of the app.
    allowedHosts: ['.up.railway.app', 'super.betsome.me'],
    proxy: {
      '/backend': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
    },
  },
});
