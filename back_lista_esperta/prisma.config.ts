import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Not env(): `prisma generate` runs during `npm ci` (Docker build) without a database.
    // migrate/seed fail with a clear error when DATABASE_URL is missing.
    url: process.env.DATABASE_URL,
  },
});
