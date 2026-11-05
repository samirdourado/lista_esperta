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
import {
  AdminOverviewDto,
  AliasDecisionDto,
  ApproveAliasDto,
  DuplicatePairDto,
  MergeProductsDto,
  MergeResultDto,
  PendingAliasDto,
  PendingStoreDto,
} from './catalog-moderation.dto.js';
import { CatalogModerationService } from './catalog-moderation.service.js';

export class SetVerificationDto {
  @ApiProperty({ enum: ['VERIFIED', 'UNVERIFIED'] })
  @IsIn(['VERIFIED', 'UNVERIFIED'])
  status: 'VERIFIED' | 'UNVERIFIED';
}

/** Moderation API behind the /admin screens. */
@ApiTags('admin')
@ApiCookieAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly claims: StoreClaimsService,
    private readonly prisma: PrismaService,
    private readonly geo: StoresGeoRepository,
    private readonly catalog: CatalogModerationService,
  ) {}

  @Get('overview')
  @ApiOkResponse({ type: AdminOverviewDto })
  overview(): Promise<AdminOverviewDto> {
    return this.catalog.overview();
  }

  /** Receipt and flyer texts the model was not sure about (confidence < 0.8). */
  @Get('aliases/pending')
  @ApiOkResponse({ type: [PendingAliasDto] })
  pendingAliases(): Promise<PendingAliasDto[]> {
    return this.catalog.pendingAliases();
  }

  @Post('aliases/:aliasId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AliasDecisionDto })
  approveAlias(
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
    @Body() dto: ApproveAliasDto,
  ): Promise<AliasDecisionDto> {
    return this.catalog.approveAlias(aliasId, dto.productId);
  }

  @Post('aliases/:aliasId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AliasDecisionDto })
  rejectAlias(
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
  ): Promise<AliasDecisionDto> {
    return this.catalog.rejectAlias(aliasId);
  }

  /** Likely duplicates: same size and brand, similar names. */
  @Get('products/duplicates')
  @ApiOkResponse({ type: [DuplicatePairDto] })
  duplicates(): Promise<DuplicatePairDto[]> {
    return this.catalog.duplicates();
  }

  @Post('products/merge')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MergeResultDto })
  merge(@Body() dto: MergeProductsDto): Promise<MergeResultDto> {
    return this.catalog.merge(dto.keepId, dto.mergeId);
  }

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
  @ApiOkResponse({ type: [PendingStoreDto] })
  async pendingVerification(): Promise<PendingStoreDto[]> {
    const pending = await this.prisma.store.findMany({
      where: { verificationStatus: 'PENDING' },
      select: { id: true, companyData: true },
      orderBy: { updatedAt: 'asc' },
    });
    const stores = await this.geo.findManyByIds(pending.map((s) => s.id));
    return pending.flatMap((row) => {
      const store = stores.find((s) => s.id === row.id);
      if (!store) return [];
      const company = row.companyData as PendingStoreDto['company'];
      return [{ store: toStoreResponse(store), company: company ?? null }];
    });
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
