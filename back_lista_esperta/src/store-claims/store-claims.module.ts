import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module.js';
import { StoreClaimsController } from './store-claims.controller.js';
import { StoreClaimsService } from './store-claims.service.js';

@Module({
  imports: [StoresModule],
  controllers: [StoreClaimsController],
  providers: [StoreClaimsService],
  exports: [StoreClaimsService],
})
export class StoreClaimsModule {}
