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
    /**
     * Proxies in front of the API whose X-Forwarded-For can be trusted, so
     * rate limits see the shopper's IP. Render + Vercel rewrite = 2; local = 0.
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

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
    OPEN_FOOD_FACTS_URL: z.url().default('https://world.openfoodfacts.org'),
    /** Public base URL of this API, used to build links to uploaded files. */
    PUBLIC_URL: z.url().default('http://localhost:3333'),
    /** Folder for uploads (store photos, receipt photos). Mounted as a volume in Docker. */
    UPLOADS_DIR: z.string().min(1).default('uploads'),
    /** Background import of shops from OpenStreetMap. Off in tests. */
    DISCOVERY_ENABLED: booleanString.default(true),
    DISCOVERY_TTL_DAYS: z.coerce.number().int().positive().default(30),

    /** Car routes for the verdict (free key at openrouteservice.org). Without it: estimates. */
    ORS_API_KEY: z.string().optional(),
    ORS_URL: z.url().default('https://api.openrouteservice.org'),
    /** Two-store split thresholds (spec section 7). */
    VERDICT_SPLIT_MIN_SAVINGS: z.coerce.number().min(0).default(10),
    VERDICT_SPLIT_MIN_SHARE: z.coerce.number().min(0).max(1).default(0.05),

    GOOGLE_MAPS_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    /** Stable alias; any model that supports images and JSON output works. */
    GEMINI_MODEL: z.string().min(3).default('gemini-2.5-flash'),
    /** Tried in order when the main model is busy (free tier 429/503) or retired (404). */
    GEMINI_FALLBACK_MODELS: z
      .string()
      .default('gemini-flash-lite-latest,gemini-3.5-flash-lite')
      .transform((value) =>
        value
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
      ),
    GEMINI_URL: z
      .url()
      .default('https://generativelanguage.googleapis.com/v1beta'),
    FIRECRAWL_API_KEY: z.string().optional(),
    FIRECRAWL_URL: z.url().default('https://api.firecrawl.dev'),
    /** Web Push (price alerts). Generate with `npx web-push generate-vapid-keys`. */
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    /** Contact for push services: a mailto: or https: URL of the project. */
    VAPID_SUBJECT: z.string().default('https://listaesperta.app'),
    /** How often price alerts are checked; 0 turns the check off (tests). */
    ALERTS_CHECK_MINUTES: z.coerce.number().int().min(0).default(15),
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
