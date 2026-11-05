import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import {
  CreateAlertDto,
  PriceAlertDto,
  PushEndpointDto,
  PushPublicKeyDto,
  PushSubscriptionDto,
  PushTestResultDto,
  UpdateAlertDto,
} from './alerts.dto.js';
import { AlertsService } from './alerts.service.js';

@ApiTags('price alerts')
@ApiCookieAuth()
@Controller()
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Public()
  @Get('push/public-key')
  @ApiOkResponse({ type: PushPublicKeyDto })
  publicKey(): PushPublicKeyDto {
    return { publicKey: this.alerts.publicKey };
  }

  @Post('push/subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: PushSubscriptionDto,
  ): Promise<void> {
    return this.alerts.subscribe(user.id, dto);
  }

  @Post('push/subscriptions/remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: PushEndpointDto,
  ): Promise<void> {
    return this.alerts.unsubscribe(user.id, dto.endpoint);
  }

  @Post('push/test')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOkResponse({ type: PushTestResultDto })
  async test(@CurrentUser() user: AuthUser): Promise<PushTestResultDto> {
    return { sent: await this.alerts.sendTest(user.id) };
  }

  @Get('alerts')
  @ApiOkResponse({ type: [PriceAlertDto] })
  list(@CurrentUser() user: AuthUser): Promise<PriceAlertDto[]> {
    return this.alerts.list(user.id);
  }

  @Post('alerts')
  @ApiCreatedResponse({ type: PriceAlertDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAlertDto,
  ): Promise<PriceAlertDto> {
    return this.alerts.create(user.id, dto);
  }

  @Patch('alerts/:id')
  @ApiOkResponse({ type: PriceAlertDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertDto,
  ): Promise<PriceAlertDto> {
    return this.alerts.update(user.id, id, dto);
  }

  @Delete('alerts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.alerts.remove(user.id, id);
  }
}
