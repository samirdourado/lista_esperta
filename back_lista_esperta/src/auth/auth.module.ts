import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OptionalJwtAuthGuard } from './guards.js';
import { JwtStrategy } from './jwt.strategy.js';
import { TokenService } from './token.service.js';

@Module({
  // Secrets are passed per call (access vs refresh), so the module needs no defaults.
  imports: [PassportModule, JwtModule.register({}), UsersModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, OptionalJwtAuthGuard],
  exports: [OptionalJwtAuthGuard],
})
export class AuthModule {}
