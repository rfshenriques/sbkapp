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
  // Unset (root "/") for local dev. Production sets this to
  // "/backoffice/super/" so this app can be reverse-proxied under
  // betsome.me/backoffice/super - see infra/nginx/betsome.me.conf. React
  // Router's basename (src/app/router.ts) reads import.meta.env.BASE_URL,
  // which Vite derives from this, so the two never drift out of sync.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Distinct from apps/frontend's 5173 and apps/backoffice's 5174 so all three can run side by side on a bare host.
    port: 5175,
    // Vite's dev server rejects requests with an unrecognized Host header by
    // default (only localhost out of the box) - without this, Railway's
    // generated *.up.railway.app domain (and later betsome.me) get a
    // blocked-request error instead of the app. Same fix apps/frontend and
    // apps/backoffice already needed for their own Railway domains.
    allowedHosts: ['.up.railway.app', 'betsome.me', 'www.betsome.me'],
    proxy: {
      '/backend': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
    },
  },
});
