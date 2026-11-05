import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/enums.js';
import type { AuthUser } from './auth.types.js';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators.js';

function isPublic(reflector: Reflector, context: ExecutionContext): boolean {
  return (
    reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? false
  );
}

/** Global: every route requires a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (isPublic(this.reflector, context)) return true;
    return super.canActivate(context);
  }
}

/**
 * For public routes that write data: attaches the user when a valid session
 * exists and lets anonymous requests through (they are attributed to X-Guest-Id).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthUser>(_error: unknown, user: TUser | false): TUser {
    // An invalid or expired token is treated as "no session", never as an error.
    return (user || undefined) as TUser;
  }
}

/** Global: enforces @Roles(...) when present. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Your account cannot access this resource');
    }
    return true;
  }
}
