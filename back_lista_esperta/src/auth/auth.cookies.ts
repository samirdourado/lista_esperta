import type { CookieOptions, Request, Response } from 'express';

export const ACCESS_COOKIE = 'le_access';
export const REFRESH_COOKIE = 'le_refresh';
/** The refresh cookie only travels to the auth routes. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface IssuedTokens {
  accessToken: string;
  accessMaxAgeMs: number;
  refreshToken: string;
  refreshMaxAgeMs: number;
}

function base(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax' };
}

export function setAuthCookies(
  res: Response,
  tokens: IssuedTokens,
  secure: boolean,
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base(secure),
    path: '/',
    maxAge: tokens.accessMaxAgeMs,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(secure),
    path: REFRESH_COOKIE_PATH,
    maxAge: tokens.refreshMaxAgeMs,
  });
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(secure), path: '/' });
  res.clearCookie(REFRESH_COOKIE, {
    ...base(secure),
    path: REFRESH_COOKIE_PATH,
  });
}

export function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}
