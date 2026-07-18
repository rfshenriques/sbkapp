import { config } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

config();

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: false,
    exclude: ['**/node_modules/**', '**/dist/**'],
    // These are integration tests against one shared real Postgres
    // instance, not isolated unit tests - some assert on singleton state
    // (e.g. bootstrap only works while a count is 0) or on global
    // aggregates (ReportsService sums across all bets, not just one
    // test's own). Running spec files in parallel lets them race each
    // other's writes; serializing them matches the assumption already
    // baked into those tests.
    fileParallelism: false,
  },
});
