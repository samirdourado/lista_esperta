import { Module } from '@nestjs/common';
import {
  SerpApiService,
  WEB_SHOPPING,
} from '../integrations/serpapi/serpapi.service.js';
import { WebPricesController } from './web-prices.controller.js';
import { WebPricesService } from './web-prices.service.js';

@Module({
  controllers: [WebPricesController],
  providers: [
    WebPricesService,
    { provide: WEB_SHOPPING, useClass: SerpApiService },
  ],
})
export class WebPricesModule {}
