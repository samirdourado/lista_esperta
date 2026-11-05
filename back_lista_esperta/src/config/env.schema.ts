import { z } from 'zod';
import { DEFAULT_USER_AGENT } from '../integrations/http.js';

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3333),
    DATABASE_URL: z.url(),
    FRONTEND_URL: z.url(),

    JWT_ACCESS_SECRET: z.string().min(32, 'use at least 32 random characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'use at least 32 random characters'),
    /** Access token lifetime in seconds (15 min). */
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    /** Refresh token lifetime in days. */
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
    /** Defaults to true in production. */
    COOKIE_SECURE: booleanString.optional(),

    /** Free map services (docs/DECISIONS.md D-031). */
    OVERPASS_URLS: z
      .string()
      .default(
        'https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter',
      )
      .transform((value) =>
        value
          .split(',')
          .map((url) => url.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
    NOMINATIM_URL: z.url().default('https://nominatim.openstreetmap.org'),
    BRASILAPI_URL: z.url().default('https://brasilapi.com.br/api'),
    HTTP_USER_AGENT: z.string().min(3).default(DEFAULT_USER_AGENT),
    /** Background import of shops from OpenStreetMap. Off in tests. */
    DISCOVERY_ENABLED: booleanString.default(true),
    DISCOVERY_TTL_DAYS: z.coerce.number().int().positive().default(30),

    GOOGLE_MAPS_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    FIRECRAWL_API_KEY: z.string().optional(),
    NFCE_PROVIDER_API_KEY: z.string().optional(),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ',
    path: ['JWT_REFRESH_SECRET'],
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  }));

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
