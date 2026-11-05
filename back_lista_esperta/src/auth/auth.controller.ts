import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AUTH_THROTTLE } from '../common/throttling.js';
import type { Env } from '../config/env.schema.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { UsersService } from '../users/users.service.js';
import {
  clearAuthCookies,
  readCookie,
  REFRESH_COOKIE,
  setAuthCookies,
} from './auth.cookies.js';
import { AuthResponseDto, LoginDto, RegisterDto } from './auth.dto.js';
import { AuthService, type SessionResult } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { CurrentUser, Public } from './decorators.js';

@ApiTags('auth')
@ApiTooManyRequestsResponse({ description: 'Too many attempts' })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get secureCookies() {
    return this.config.get('COOKIE_SECURE', { infer: true });
  }

  private respond(res: Response, session: SessionResult): AuthResponseDto {
    setAuthCookies(res, session.tokens, this.secureCookies);
    return { user: session.user };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'E-mail already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.respond(res, await this.auth.register(dto));
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid e-mail or password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.respond(res, await this.auth.login(dto));
  }

  /** Rotates the refresh cookie and issues a new access cookie. */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, expired or reused token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    try {
      return this.respond(
        res,
        await this.auth.refresh(readCookie(req, REFRESH_COOKIE)),
      );
    } catch (error) {
      clearAuthCookies(res, this.secureCookies);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res, this.secureCookies);
  }

  /** Used by the front's proxy to protect /merchant, /admin and /account. */
  @Get('me')
  @ApiCookieAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse()
  me(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.users.getProfile(user.id);
  }
}
