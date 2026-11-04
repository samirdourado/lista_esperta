import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.url(),
  FRONTEND_URL: z.url(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  NFCE_PROVIDER_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: the API refuses to boot when a required variable is missing. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value === '' ? undefined : value,
    ]),
  );
  const result = envSchema.safeParse(normalized);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
