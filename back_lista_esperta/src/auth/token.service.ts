import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.schema.js';
import type { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { IssuedTokens } from './auth.cookies.js';
import type {
  AccessTokenPayload,
  AuthUser,
  RefreshTokenPayload,
} from './auth.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Access + refresh tokens with rotation and reuse detection. */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get accessTtlSeconds() {
    return this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  private get refreshTtlMs() {
    return this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  async issue(user: { id: string; role: Role }): Promise<IssuedTokens> {
    const accessPayload: AccessTokenPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.accessTtlSeconds,
      algorithm: 'HS256',
    });

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: Math.floor(this.refreshTtlMs / 1000),
      algorithm: 'HS256',
    });
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: sha256(refreshToken).toString('hex'),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    return {
      accessToken,
      accessMaxAgeMs: this.accessTtlSeconds * 1000,
      refreshToken,
      refreshMaxAgeMs: this.refreshTtlMs,
    };
  }

  /**
   * Exchanges a refresh token for a new pair and revokes the old one.
   * Presenting an already-revoked token means it leaked: every session of
   * that user is revoked.
   */
  async rotate(
    refreshToken: string,
  ): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    const payload = await this.verifyRefresh(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: { select: { id: true, role: true } } },
    });
    if (!row || row.userId !== payload.sub) throw this.invalid();

    if (row.revokedAt) {
      await this.revokeAllForUser(row.userId);
      throw this.invalid();
    }
    const expected = Buffer.from(row.tokenHash, 'hex');
    const actual = sha256(refreshToken);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual) ||
      row.expiresAt.getTime() <= Date.now()
    ) {
      throw this.invalid();
    }

    // Only one concurrent rotation of the same token may win.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw this.invalid();

    const tokens = await this.issue(row.user);
    return { user: row.user, tokens };
  }

  /** Logout: revokes the presented refresh token if it is valid; never throws. */
  async revoke(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.verifyRefresh(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Nothing to revoke.
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        algorithms: ['HS256'],
      });
    } catch {
      throw this.invalid();
    }
  }

  private invalid() {
    return new UnauthorizedException('Session expired, please sign in again');
  }
}
