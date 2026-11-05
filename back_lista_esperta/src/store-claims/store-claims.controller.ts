import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import {
  CreateStoreClaimDto,
  CreateStoreClaimResponseDto,
  StoreClaimResponseDto,
} from './store-claims.dto.js';
import { StoreClaimsService } from './store-claims.service.js';

@ApiTags('store-claims')
@ApiCookieAuth()
@Roles('MERCHANT')
@Controller('store-claims')
export class StoreClaimsController {
  constructor(private readonly claims: StoreClaimsService) {}

  /** Asks to run an existing store. With a matching CNPJ it is approved at once. */
  @Post()
  @ApiCreatedResponse({ type: CreateStoreClaimResponseDto })
  @ApiConflictResponse({ description: 'ALREADY_MEMBER or CNPJ_TAKEN' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStoreClaimDto,
  ): Promise<CreateStoreClaimResponseDto> {
    return this.claims.create(user.id, dto);
  }

  @Get('mine')
  @ApiOkResponse({ type: [StoreClaimResponseDto] })
  mine(@CurrentUser() user: AuthUser): Promise<StoreClaimResponseDto[]> {
    return this.claims.mine(user.id);
  }
}
