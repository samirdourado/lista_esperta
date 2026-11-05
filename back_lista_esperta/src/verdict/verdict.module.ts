import { Module } from '@nestjs/common';
import {
  GeminiService,
  LIST_READER,
} from '../integrations/gemini/gemini.service.js';
import { RoutesService } from '../integrations/routes/routes.service.js';
import { SponsoredService } from '../sponsored/sponsored.service.js';
import { StoresModule } from '../stores/stores.module.js';
import { VerdictController } from './verdict.controller.js';
import { VerdictRepository } from './verdict.repository.js';
import { VerdictService } from './verdict.service.js';

@Module({
  imports: [StoresModule],
  controllers: [VerdictController],
  providers: [
    VerdictService,
    VerdictRepository,
    RoutesService,
    SponsoredService,
    GeminiService,
    { provide: LIST_READER, useExisting: GeminiService },
  ],
})
export class VerdictModule {}
