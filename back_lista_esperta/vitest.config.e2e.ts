import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
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
