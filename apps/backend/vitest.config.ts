import { config } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

config();

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: false,
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
