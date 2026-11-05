import createClient from "openapi-fetch";
import { API_URL, baseUrlOf } from "./config";
import type { paths } from "./schema";

const AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every request that got a 401 meanwhile. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * The access cookie lives 15 minutes. When a call answers 401, renew the
 * session with the refresh cookie once and repeat the call.
 */
async function fetchWithRefresh(request: Request): Promise<Response> {
  const retry = request.clone();
  const response = await fetch(request);
  const isAuthCall = AUTH_PATHS.some((path) => new URL(request.url).pathname.endsWith(path));
  if (response.status !== 401 || isAuthCall) return response;
  return (await refreshSession()) ? fetch(retry) : response;
}

export const api = createClient<paths>({
  baseUrl: baseUrlOf(API_URL),
  credentials: "include",
  fetch: fetchWithRefresh,
});
