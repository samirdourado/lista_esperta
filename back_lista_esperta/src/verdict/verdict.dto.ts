import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SponsoredItemDto } from '../sponsored/sponsored.service.js';
import { AddressDto } from '../stores/stores.dto.js';

export class PointDto {
  @ApiProperty({ example: -23.5891 }) @IsLatitude() lat: number;
  @ApiProperty({ example: -46.6346 }) @IsLongitude() lng: number;
}

export class VerdictItemInputDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'From the catalog autocomplete',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    example: '7896006716112',
    description: 'Barcode, when picked from the product search',
  })
  @IsOptional()
  @Matches(/^\d{8,14}$/)
  ean?: string;

  @ApiProperty({ example: 'arroz 5kg', description: 'What the person typed' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 200)
  text: string;

  @ApiPropertyOptional({ default: 1, example: 2 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999)
  quantity?: number;
}

export class VerdictRequestDto {
  @ApiProperty({ type: PointDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PointDto)
  origin: PointDto;

  @ApiProperty({ type: [VerdictItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => VerdictItemInputDto)
  items: VerdictItemInputDto[];

  @ApiPropertyOptional({ default: 5, minimum: 0.5, maximum: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(20)
  radiusKm?: number;
}

/** Lowest price seen on Google Shopping for the item: reference only (D-076). */
export class WebReferenceDto {
  @ApiProperty() price: number;
  @ApiProperty({ example: 'Carrefour' }) store: string;
  @ApiProperty() title: string;
  @ApiProperty({ format: 'date-time' }) seenAt: string;
}

export class ResolvedItemDto {
  @ApiProperty() index: number;
  @ApiProperty() text: string;
  @ApiProperty() quantity: number;
  @ApiProperty({ nullable: true, type: String }) productId: string | null;
  @ApiProperty({ nullable: true, type: String }) productName: string | null;
  @ApiProperty({ description: 'Some store nearby has a price for it' })
  priced: boolean;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Median of stores nearby',
  })
  regionalMedian: number | null;
  @ApiProperty({
    type: WebReferenceDto,
    nullable: true,
    description:
      'Lowest price on the internet around the shopper; never in the ranking',
  })
  webPrice: WebReferenceDto | null;
}

export class PriceEvidenceDto {
  @ApiProperty({
    enum: ['NFCE', 'MERCHANT', 'FLYER', 'COMMUNITY', 'PRECOMELHOR'],
  })
  source: string;
  @ApiProperty({ format: 'date-time' }) observedAt: string;
  @ApiProperty({ description: 'Receipts with this product here in 7 days' })
  receiptCount: number;
  @ApiProperty({ description: 'A merchant offer with an end date' })
  offer: boolean;
}

export class StoreLineDto {
  @ApiProperty() index: number;
  @ApiProperty({ nullable: true, type: Number }) unitPrice: number | null;
  @ApiProperty({ nullable: true, type: Number }) subtotal: number | null;
  @ApiProperty({ type: PriceEvidenceDto, nullable: true })
  evidence: PriceEvidenceDto | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Name of the product found at this store',
  })
  productName: string | null;
  @ApiProperty({ nullable: true, type: String }) imageUrl: string | null;
}

export class VerdictStoreDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty({ type: AddressDto, nullable: true }) address: AddressDto | null;
  @ApiProperty({ enum: ['UNVERIFIED', 'PENDING', 'VERIFIED'] })
  verificationStatus: string;
  @ApiProperty({
    nullable: true,
    type: Boolean,
    description: 'null = hours unknown',
  })
  openNow: boolean | null;
}

export class RankedStoreDto {
  @ApiProperty({ type: VerdictStoreDto }) store: VerdictStoreDto;
  @ApiProperty() itemsCost: number;
  @ApiProperty({ description: 'Regional median of the items this store lacks' })
  missingPenalty: number;
  @ApiProperty({ description: 'Round trip' }) travelKm: number;
  @ApiProperty() travelMinutes: number;
  @ApiProperty({
    description: 'Items plus the regional median of the missing ones',
  })
  totalCost: number;
  @ApiProperty() found: number;
  @ApiProperty({ description: 'Items priced somewhere nearby ("X de Y")' })
  priced: number;
  @ApiProperty({ type: [Number] }) missing: number[];
  @ApiProperty({ type: [StoreLineDto] }) lines: StoreLineDto[];
}

export class SplitDto {
  @ApiProperty({ type: [VerdictStoreDto] }) stores: VerdictStoreDto[];
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Item index → store id',
    example: { 0: 'uuid-a', 1: 'uuid-b' },
  })
  assignment: Record<string, string>;
  @ApiProperty() itemsCost: number;
  @ApiProperty() missingPenalty: number;
  @ApiProperty() travelKm: number;
  @ApiProperty() travelMinutes: number;
  @ApiProperty() totalCost: number;
  @ApiProperty({ description: 'Against the best single store' })
  savings: number;
}

export class VerdictParamsDto {
  @ApiProperty() radiusKm: number;
  @ApiProperty() splitMinSavings: number;
  @ApiProperty() splitMinShare: number;
  @ApiProperty({ enum: ['OPENROUTESERVICE', 'ESTIMATE'] }) routing: string;
  @ApiProperty() storesConsidered: number;
  @ApiProperty({ description: 'Store addresses still being looked up' })
  addressesPending: number;
  @ApiProperty({ description: 'Stores left out because they are closed now' })
  storesClosed: number;
  @ApiProperty({ description: 'Map areas still importing shops' })
  pendingAreas: number;
}

export class VerdictResponseDto {
  @ApiProperty({ type: [ResolvedItemDto] }) items: ResolvedItemDto[];
  @ApiProperty({ type: [RankedStoreDto], description: 'By total cost only' })
  ranking: RankedStoreDto[];
  @ApiProperty({ type: SplitDto, nullable: true }) split: SplitDto | null;
  @ApiProperty({ type: VerdictParamsDto }) params: VerdictParamsDto;
  @ApiProperty({
    type: [SponsoredItemDto],
    description: 'Separate block; never changes the ranking',
  })
  sponsored: SponsoredItemDto[];
  @ApiProperty({ format: 'date-time' }) computedAt: string;
}

export class ParsedListLineDto {
  @ApiProperty({ example: 'arroz 5kg' }) text: string;
  @ApiProperty({ example: 1 }) quantity: number;
}
