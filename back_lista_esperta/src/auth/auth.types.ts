import type { Role } from '../generated/prisma/enums.js';

/** What the access token carries and what guards attach to `request.user`. */
export interface AuthUser {
  id: string;
  role: Role;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  /** Id of the refresh_tokens row. */
  jti: string;
}

/** Who performed a public write: a signed-in user, an anonymous device, or both unknown. */
export interface Actor {
  userId?: string;
  guestId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}
  }
}
