import { Module } from '@nestjs/common';
import {
  GeminiService,
  LIST_READER,
} from '../integrations/gemini/gemini.service.js';
import { RoutesService } from '../integrations/routes/routes.service.js';
import { SponsoredService } from '../sponsored/sponsored.service.js';
import { StoresModule } from '../stores/stores.module.js';
import { WebPricesModule } from '../web-prices/web-prices.module.js';
import { DirectoryPricesService } from './directory-prices.service.js';
import { VerdictController } from './verdict.controller.js';
import { VerdictRepository } from './verdict.repository.js';
import { VerdictService } from './verdict.service.js';

@Module({
  imports: [StoresModule, WebPricesModule],
  controllers: [VerdictController],
  providers: [
    VerdictService,
    VerdictRepository,
    DirectoryPricesService,
    RoutesService,
    SponsoredService,
    GeminiService,
    { provide: LIST_READER, useExisting: GeminiService },
  ],
  // Price alerts read prices with the same rule as the verdict.
  exports: [VerdictRepository],
})
export class VerdictModule {}
