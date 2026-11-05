import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import {
  AddressDto,
  StoreResponseDto,
  VerificationChecksDto,
} from '../stores/stores.dto.js';

/** What the Receita Federal record said, for the admin to compare. */
export class CompanySnapshotDto {
  @ApiProperty() legalName: string;
  @ApiProperty({ type: String, nullable: true }) tradeName: string | null;
  @ApiProperty({ example: 'ATIVA' }) registrationStatus: string;
  @ApiProperty({ type: AddressDto }) address: AddressDto;
  @ApiProperty({ type: VerificationChecksDto }) checks: VerificationChecksDto;
}

export class PendingStoreDto {
  @ApiProperty({ type: StoreResponseDto }) store: StoreResponseDto;
  @ApiProperty({ type: CompanySnapshotDto, nullable: true })
  company: CompanySnapshotDto | null;
}

export class AdminOverviewDto {
  @ApiProperty() pendingClaims: number;
  @ApiProperty() pendingVerifications: number;
  @ApiProperty() pendingAliases: number;
}

export class AdminProductDto {
  @ApiProperty() id: string;
  @ApiProperty() canonicalName: string;
  @ApiProperty({ type: String, nullable: true }) brand: string | null;
  @ApiProperty({ type: String, nullable: true }) gtin: string | null;
  @ApiProperty() unit: string;
  @ApiProperty() unitQuantity: number;
  @ApiProperty({ description: 'Price observations of this product' })
  prices: number;
}

export class AliasStoreDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class PendingAliasDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'Text as printed on receipts or flyers' })
  rawText: string;
  @ApiProperty({ type: AliasStoreDto, nullable: true })
  store: AliasStoreDto | null;
  @ApiProperty({
    type: AdminProductDto,
    description: 'What the model suggested',
  })
  product: AdminProductDto;
  @ApiProperty({ description: 'Receipt lines and flyer items with this text' })
  occurrences: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class ApproveAliasDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Another product, when the suggestion was wrong',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class AliasDecisionDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  status: 'APPROVED' | 'REJECTED';
  @ApiProperty({ description: 'Prices created from past receipts and flyers' })
  pricesAdded: number;
}

export class DuplicatePairDto {
  @ApiProperty({ type: AdminProductDto }) a: AdminProductDto;
  @ApiProperty({ type: AdminProductDto }) b: AdminProductDto;
  @ApiProperty({ description: 'Name similarity, 0 to 1' }) score: number;
}

export class MergeProductsDto {
  @ApiProperty({ format: 'uuid', description: 'Product that stays' })
  @IsUUID()
  keepId: string;
  @ApiProperty({ format: 'uuid', description: 'Product folded into it' })
  @IsUUID()
  mergeId: string;
}

export class MergeResultDto {
  @ApiProperty({ type: AdminProductDto }) product: AdminProductDto;
  @ApiProperty() pricesMoved: number;
  @ApiProperty() aliasesMoved: number;
}
