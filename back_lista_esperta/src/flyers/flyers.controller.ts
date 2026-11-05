import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { StoreMemberGuard } from '../stores/store-member.guard.js';
import { FlyerImportDto, ImportFlyerDto } from './flyers.dto.js';
import { FlyersService } from './flyers.service.js';

/** The store's own flyers, read from a public link. Members only. */
@ApiTags('store flyers')
@ApiCookieAuth()
@Roles('MERCHANT', 'ADMIN')
@UseGuards(StoreMemberGuard)
@Controller('stores/:storeId/flyers')
export class FlyersController {
  constructor(private readonly flyers: FlyersService) {}

  @Get()
  @ApiOkResponse({ type: [FlyerImportDto] })
  list(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<FlyerImportDto[]> {
    return this.flyers.list(storeId);
  }

  /** Each import spends Firecrawl and Gemini quota: a few per minute. */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: FlyerImportDto })
  import(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: ImportFlyerDto,
    @CurrentUser() user: AuthUser,
  ): Promise<FlyerImportDto> {
    return this.flyers.import(storeId, dto.url, user.id);
  }
}
