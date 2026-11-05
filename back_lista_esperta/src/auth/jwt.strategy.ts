import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config/env.schema.js';
import { ACCESS_COOKIE, readCookie } from './auth.cookies.js';
import type { AccessTokenPayload, AuthUser } from './auth.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      // Browser: httpOnly cookie. Swagger and scripts: Authorization: Bearer.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => readCookie(req, ACCESS_COOKIE) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  validate(payload: AccessTokenPayload): AuthUser {
    return { id: payload.sub, role: payload.role };
  }
}
