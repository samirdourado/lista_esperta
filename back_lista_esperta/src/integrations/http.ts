/**
 * Identifies the app to free public services (OSM, Nominatim, BrasilAPI ask
 * for it). Generic on purpose: no personal contact data. Override with
 * HTTP_USER_AGENT, e.g. to add the public URL of the deployed app.
 */
export const DEFAULT_USER_AGENT = 'ListaEsperta/0.1';

export class ExternalServiceError extends Error {
  constructor(
    readonly service: string,
    readonly status: number | null,
    message: string,
  ) {
    super(`${service}: ${message}`);
    this.name = 'ExternalServiceError';
  }
}

export async function fetchJson<T>(
  service: string,
  url: string,
  init: RequestInit & { timeoutMs: number; userAgent: string },
): Promise<{ status: number; body: T | null }> {
  const { timeoutMs, userAgent, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
        ...headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'network error';
    throw new ExternalServiceError(service, null, reason);
  }
  if (!response.ok) return { status: response.status, body: null };
  try {
    return { status: response.status, body: (await response.json()) as T };
  } catch {
    throw new ExternalServiceError(service, response.status, 'invalid JSON');
  }
}
