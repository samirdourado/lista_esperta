const DEFAULT_API_URL = "http://localhost:3333/api/v1";

/** Public API URL used by the browser, e.g. http://localhost:3333/api/v1. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");

/**
 * URL used by server-side code (proxy.ts). Inside Docker the browser URL
 * (localhost) points at the web container itself, so the API is reached by
 * its service name instead.
 */
export function serverApiUrl(): string {
  return (process.env.API_INTERNAL_URL ?? API_URL).replace(/\/$/, "");
}

/** The generated OpenAPI paths already start with /api/v1, so the client base drops it. */
export function baseUrlOf(apiUrl: string): string {
  return apiUrl.replace(/\/api\/v1$/, "");
}
