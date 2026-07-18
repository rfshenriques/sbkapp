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
  plugins: [react(), tailwindcss()],
  server: {
    // Distinct from apps/frontend's 5173 and apps/backoffice's 5174 so all three can run side by side on a bare host.
    port: 5175,
    proxy: {
      '/backend': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ''),
      },
    },
  },
});
