import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service.js';
import { StoreMemberGuard } from './store-member.guard.js';
import { StoresController } from './stores.controller.js';
import { StoresGeoRepository } from './stores-geo.repository.js';
import { StoresService } from './stores.service.js';
import { VerificationService } from './verification.service.js';

@Module({
  controllers: [StoresController],
  providers: [
    StoresGeoRepository,
    StoreMemberGuard,
    StoresService,
    DiscoveryService,
    VerificationService,
  ],
  exports: [
    StoresGeoRepository,
    StoreMemberGuard,
    VerificationService,
    DiscoveryService,
  ],
})
export class StoresModule {}
