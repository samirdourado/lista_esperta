import { Module } from '@nestjs/common';
import {
  SerpApiService,
  WEB_SHOPPING,
} from '../integrations/serpapi/serpapi.service.js';
import { WebPricesController } from './web-prices.controller.js';
import { WebPricesRepository } from './web-prices.repository.js';
import { WebPricesService } from './web-prices.service.js';

@Module({
  controllers: [WebPricesController],
  providers: [
    WebPricesService,
    WebPricesRepository,
    { provide: WEB_SHOPPING, useClass: SerpApiService },
  ],
  // The verdict shows "na internet a partir de R$ X" next to each item.
  exports: [WebPricesRepository],
})
export class WebPricesModule {}
