import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './test/test-env.mjs';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Booting the Nest app can take >10 s while the Docker containers recompile on the same machine.
    hookTimeout: 30_000,
    testTimeout: 15_000,
    // Suites share one database and truncate it, so they must not run in parallel.
    fileParallelism: false,
    // e2e tests run against a dedicated database in the same Postgres container.
    env: TEST_ENV,
  },
});
