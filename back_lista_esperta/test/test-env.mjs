// Shared by vitest.config.e2e.ts and scripts/prepare-test-db.mjs.
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://lista:lista@localhost:5433/lista_esperta_test?schema=public';

export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  FRONTEND_URL: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef012345678',
  THROTTLE_DISABLED: 'true',
  // Store discovery calls OpenStreetMap; stores.e2e-spec.ts turns it on with a fake.
  DISCOVERY_ENABLED: 'false',
  // No real network; verdict.e2e-spec.ts uses a fake directory.
  PRECOMELHOR_ENABLED: 'false',
  // Uploads from e2e tests go to a throwaway folder (gitignored).
  UPLOADS_DIR: 'test-uploads',
  // Tests call AlertsService.checkAll() themselves.
  ALERTS_CHECK_MINUTES: '0',
};
