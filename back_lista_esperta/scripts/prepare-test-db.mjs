// Applies migrations to the e2e database before `npm run test:e2e`.
import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from '../test/test-env.mjs';

execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
});
