import { Module } from '@nestjs/common';
import {
  GeminiService,
  PRODUCT_NORMALIZER,
  RECEIPT_READER,
} from '../integrations/gemini/gemini.service.js';
import { StoresModule } from '../stores/stores.module.js';
import { NormalizationService } from './normalization.service.js';
import { ReceiptsController } from './receipts.controller.js';
import { ReceiptsService } from './receipts.service.js';
import { HttpSefazFetcher, SEFAZ_FETCHER } from './sefaz-fetcher.js';

@Module({
  imports: [StoresModule],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    NormalizationService,
    GeminiService,
    { provide: PRODUCT_NORMALIZER, useExisting: GeminiService },
    { provide: RECEIPT_READER, useExisting: GeminiService },
    { provide: SEFAZ_FETCHER, useClass: HttpSefazFetcher },
  ],
  exports: [NormalizationService],
})
export class ReceiptsModule {}
