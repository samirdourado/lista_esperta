import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Booting the Nest app can take >10 s while the Docker containers recompile on the same machine.
    hookTimeout: 30_000,
    testTimeout: 15_000,
    // e2e tests run against a dedicated database in the same Postgres container.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL_TEST ??
        'postgresql://lista:lista@localhost:5433/lista_esperta_test?schema=public',
      FRONTEND_URL: 'http://localhost:3000',
    },
  },
});
