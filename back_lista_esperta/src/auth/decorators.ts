import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import type { Role } from '../generated/prisma/enums.js';
import type { Actor, AuthUser } from './auth.types.js';

export const IS_PUBLIC_KEY = 'isPublic';
/** Opens a route to visitors without an account. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restricts a route to the given roles (checked by RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const GUEST_ID_HEADER = 'x-guest-id';

/** The signed-in user. Only use on routes that require authentication. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user) throw new UnauthorizedException();
    return request.user;
  },
);

/** Reads and validates the anonymous device id sent by guests. */
export function readGuestId(request: Request): string | undefined {
  const raw = request.headers[GUEST_ID_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === '') return undefined;
  if (!isUUID(value, 4)) {
    throw new BadRequestException(`${GUEST_ID_HEADER} must be a UUID v4`);
  }
  return value.toLowerCase();
}

/**
 * Who is writing on a public route: the session user (via OptionalJwtAuthGuard)
 * and/or the X-Guest-Id device id.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return { userId: request.user?.id, guestId: readGuestId(request) };
  },
);
