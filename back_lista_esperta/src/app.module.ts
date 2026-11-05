import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard, RolesGuard } from './auth/guards.js';
import { THROTTLERS } from './common/throttling.js';
import { validateEnv } from './config/env.schema.js';
import { FlyersModule } from './flyers/flyers.module.js';
import { GeocodingModule } from './geocoding/geocoding.module.js';
import { HealthModule } from './health/health.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { PricesModule } from './prices/prices.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductsModule } from './products/products.module.js';
import { ReceiptsModule } from './receipts/receipts.module.js';
import { ShoppingListsModule } from './shopping-lists/shopping-lists.module.js';
import { StoreClaimsModule } from './store-claims/store-claims.module.js';
import { StorageModule } from './storage/storage.module.js';
import { StoresModule } from './stores/stores.module.js';
import { UsersModule } from './users/users.module.js';
import { VerdictModule } from './verdict/verdict.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Tests use only test/test-env.mjs: real API keys in .env must never reach them.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    ThrottlerModule.forRoot(THROTTLERS),
    PrismaModule,
    IntegrationsModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StoresModule,
    StoreClaimsModule,
    GeocodingModule,
    AdminModule,
    ProductsModule,
    PricesModule,
    ReceiptsModule,
    VerdictModule,
    ShoppingListsModule,
    FlyersModule,
    AlertsModule,
  ],
  providers: [
    // Order matters: rate limit, then authenticate, then check roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
