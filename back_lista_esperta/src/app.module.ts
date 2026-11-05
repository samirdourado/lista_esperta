import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard, RolesGuard } from './auth/guards.js';
import { THROTTLERS } from './common/throttling.js';
import { validateEnv } from './config/env.schema.js';
import { GeocodingModule } from './geocoding/geocoding.module.js';
import { HealthModule } from './health/health.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ShoppingListsModule } from './shopping-lists/shopping-lists.module.js';
import { StoreClaimsModule } from './store-claims/store-claims.module.js';
import { StoresModule } from './stores/stores.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot(THROTTLERS),
    PrismaModule,
    IntegrationsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StoresModule,
    StoreClaimsModule,
    GeocodingModule,
    AdminModule,
    ShoppingListsModule,
  ],
  providers: [
    // Order matters: rate limit, then authenticate, then check roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
