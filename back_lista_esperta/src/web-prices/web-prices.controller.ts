import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators.js';
import { WebPriceQueryDto, WebPriceResponseDto } from './web-prices.dto.js';
import { WebPricesService } from './web-prices.service.js';

@ApiTags('web-prices')
@Controller()
export class WebPricesController {
  constructor(private readonly webPrices: WebPricesService) {}

  /**
   * Cheapest offers on Google Shopping for a product, in the person's city.
   * Reference prices only: they never enter the verdict ranking.
   */
  @Public()
  // Each search spends the small monthly quota; the cache absorbs repeats.
  @Throttle({
    ip: { limit: 20, ttl: 60 * 60_000 },
    default: { limit: 10, ttl: 60 * 60_000 },
  })
  @Get('web-prices')
  @ApiOkResponse({ type: WebPriceResponseDto })
  @ApiServiceUnavailableResponse({
    description: 'WEB_SEARCH_UNAVAILABLE | WEB_SEARCH_FAILED',
  })
  @ApiTooManyRequestsResponse({ description: 'WEB_SEARCH_QUOTA' })
  search(@Query() query: WebPriceQueryDto): Promise<WebPriceResponseDto> {
    return this.webPrices.search(query);
  }
}
