import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Roles } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AdminClaimQueryDto,
  AdminStoreClaimResponseDto,
  StoreClaimResponseDto,
} from '../store-claims/store-claims.dto.js';
import { StoreClaimsService } from '../store-claims/store-claims.service.js';
import { StoreResponseDto } from '../stores/stores.dto.js';
import { StoresGeoRepository } from '../stores/stores-geo.repository.js';
import { toStoreResponse } from '../stores/stores.service.js';

export class SetVerificationDto {
  @ApiProperty({ enum: ['VERIFIED', 'UNVERIFIED'] })
  @IsIn(['VERIFIED', 'UNVERIFIED'])
  status: 'VERIFIED' | 'UNVERIFIED';
}

/** Moderation API. The admin screens arrive in phase 8; Swagger works today. */
@ApiTags('admin')
@ApiCookieAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly claims: StoreClaimsService,
    private readonly prisma: PrismaService,
    private readonly geo: StoresGeoRepository,
  ) {}

  @Get('store-claims')
  @ApiOkResponse({ type: [AdminStoreClaimResponseDto] })
  listClaims(
    @Query() query: AdminClaimQueryDto,
  ): Promise<AdminStoreClaimResponseDto[]> {
    return this.claims.list(query.status);
  }

  @Post('store-claims/:claimId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: StoreClaimResponseDto })
  approve(
    @Param('claimId', ParseUUIDPipe) claimId: string,
  ): Promise<StoreClaimResponseDto> {
    return this.claims.decide(claimId, 'APPROVED');
  }

  @Post('store-claims/:claimId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: StoreClaimResponseDto })
  reject(
    @Param('claimId', ParseUUIDPipe) claimId: string,
  ): Promise<StoreClaimResponseDto> {
    return this.claims.decide(claimId, 'REJECTED');
  }

  /** Stores whose CNPJ check needs a human look. */
  @Get('stores/pending-verification')
  @ApiOkResponse({ type: [StoreResponseDto] })
  async pendingVerification(): Promise<StoreResponseDto[]> {
    const ids = await this.prisma.store.findMany({
      where: { verificationStatus: 'PENDING' },
      select: { id: true },
      orderBy: { updatedAt: 'asc' },
    });
    return (await this.geo.findManyByIds(ids.map((s) => s.id))).map(
      toStoreResponse,
    );
  }

  @Post('stores/:storeId/verification')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: StoreResponseDto })
  async setVerification(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: SetVerificationDto,
  ): Promise<StoreResponseDto> {
    await this.prisma.store.update({
      where: { id: storeId },
      data: { verificationStatus: dto.status },
    });
    return toStoreResponse((await this.geo.findById(storeId))!);
  }
}
