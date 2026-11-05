import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { UsersService } from '../users/users.service.js';
import type { IssuedTokens } from './auth.cookies.js';
import type { LoginDto, RegisterDto } from './auth.dto.js';
import { TokenService } from './token.service.js';

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations).
const ARGON2_OPTIONS: argon2.HashOptions & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export interface SessionResult {
  user: UserResponseDto;
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  /** Hash checked when the e-mail does not exist, so both paths take the same time. */
  private readonly dummyHash = argon2.hash(
    'timing-equalizer-password',
    ARGON2_OPTIONS,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<SessionResult> {
    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTIONS);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
          role: dto.role,
        },
      });
      return {
        user: UserResponseDto.from(user),
        tokens: await this.tokens.issue(user),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('E-mail already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid = await argon2.verify(
      user?.passwordHash ?? (await this.dummyHash),
      dto.password,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid e-mail or password');
    }
    return {
      user: await this.users.getProfile(user.id),
      tokens: await this.tokens.issue(user),
    };
  }

  async refresh(refreshToken: string | undefined): Promise<SessionResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }
    const { user, tokens } = await this.tokens.rotate(refreshToken);
    return { user: await this.users.getProfile(user.id), tokens };
  }

  logout(refreshToken: string | undefined): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}
