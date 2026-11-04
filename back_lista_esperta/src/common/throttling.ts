import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';
import { GUEST_ID_HEADER } from '../auth/decorators.js';

const MINUTE = 60_000;

function ipOf(req: Record<string, unknown>): string {
  return (req as unknown as Request).ip ?? 'unknown';
}

function guestOf(req: Record<string, unknown>): string {
  const raw = (req as unknown as Request).headers[GUEST_ID_HEADER];
  return ((Array.isArray(raw) ? raw[0] : raw) ?? '').slice(0, 36);
}

/**
 * Two buckets per request:
 * - `ip`: generous cap per IP, so rotating X-Guest-Id cannot escape the limit;
 * - `default`: per IP + guest id, so guests behind the same carrier NAT do not
 *   exhaust each other's quota.
 * Auth and receipt uploads tighten both with @Throttle (see AUTH_THROTTLE).
 */
export const THROTTLERS: ThrottlerModuleOptions = {
  throttlers: [
    { name: 'ip', ttl: MINUTE, limit: 300, getTracker: (req) => ipOf(req) },
    {
      name: 'default',
      ttl: MINUTE,
      limit: 120,
      getTracker: (req) => `${ipOf(req)}|${guestOf(req)}`,
    },
  ],
  // e2e suites fire many logins in a row; the limits themselves are covered by
  // throttling.e2e-spec.ts, which turns them back on.
  skipIf: () => process.env.THROTTLE_DISABLED === 'true',
};

/** 10 attempts per minute per client and 20 per IP. */
export const AUTH_THROTTLE = {
  ip: { limit: 20, ttl: MINUTE },
  default: { limit: 10, ttl: MINUTE },
};
