import { Module } from '@nestjs/common';
import { StoreClaimsModule } from '../store-claims/store-claims.module.js';
import { StoresModule } from '../stores/stores.module.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [StoresModule, StoreClaimsModule],
  controllers: [AdminController],
})
export class AdminModule {}
