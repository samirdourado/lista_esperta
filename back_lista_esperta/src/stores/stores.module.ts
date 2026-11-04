import { Module } from '@nestjs/common';
import { StoreMemberGuard } from './store-member.guard.js';
import { StoresController } from './stores.controller.js';
import { StoresGeoRepository } from './stores-geo.repository.js';

@Module({
  controllers: [StoresController],
  providers: [StoresGeoRepository, StoreMemberGuard],
  exports: [StoresGeoRepository, StoreMemberGuard],
})
export class StoresModule {}
