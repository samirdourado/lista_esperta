import { Module } from '@nestjs/common';
import {
  FirecrawlService,
  FLYER_SCRAPER,
} from '../integrations/firecrawl/firecrawl.service.js';
import {
  FLYER_READER,
  GeminiService,
} from '../integrations/gemini/gemini.service.js';
import { ReceiptsModule } from '../receipts/receipts.module.js';
import { StoresModule } from '../stores/stores.module.js';
import { FlyersController } from './flyers.controller.js';
import { FlyersService } from './flyers.service.js';

@Module({
  imports: [ReceiptsModule, StoresModule],
  controllers: [FlyersController],
  providers: [
    FlyersService,
    GeminiService,
    { provide: FLYER_READER, useExisting: GeminiService },
    { provide: FLYER_SCRAPER, useClass: FirecrawlService },
  ],
})
export class FlyersModule {}
