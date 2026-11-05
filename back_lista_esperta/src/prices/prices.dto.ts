import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { UNITS } from '../products/products.dto.js';
import type { MeasureUnit } from '../generated/prisma/enums.js';

export class CatalogQueryDto {
  @ApiPropertyOptional({ description: 'Name or barcode' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  q?: string;
}

export class PriceInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 12.9 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  price: number;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Makes it an offer that ends at this moment (up to 90 days ahead)',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validUntil?: Date;
}

export class SetPricesDto {
  @ApiProperty({ type: [PriceInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PriceInputDto)
  prices: PriceInputDto[];
}

export class CatalogItemDto {
  @ApiProperty({ format: 'uuid' }) productId: string;
  @ApiProperty({ nullable: true, type: String }) gtin: string | null;
  @ApiProperty() canonicalName: string;
  @ApiProperty({ nullable: true, type: String }) brand: string | null;
  @ApiProperty() categorySlug: string;
  @ApiProperty({ enum: UNITS, enumName: 'MeasureUnit' }) unit: MeasureUnit;
  @ApiProperty() unitQuantity: number;
  @ApiProperty({ nullable: true, type: Number }) regularPrice: number | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  regularObservedAt: string | null;
  @ApiProperty({ nullable: true, type: String }) offerId: string | null;
  @ApiProperty({ nullable: true, type: Number }) offerPrice: number | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  offerValidUntil: string | null;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Median of other stores within 5 km',
  })
  regionMedian: number | null;
  @ApiProperty({ description: 'Stores behind the median' })
  regionStores: number;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Latest NFC-e price paid here (7 days)',
  })
  receiptPrice: number | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  receiptAt: string | null;
  @ApiProperty({
    description: 'Receipt differs more than 15 % from the regular price',
  })
  divergent: boolean;
}

export class ImportRowErrorDto {
  @ApiProperty({ description: 'Line in the file (1 = header)' }) line: number;
  @ApiProperty({
    enum: [
      'MISSING_PRICE',
      'INVALID_GTIN',
      'PRODUCT_NOT_FOUND',
      'INVALID_DATE',
      'UNKNOWN_CATEGORY',
      'INVALID_UNIT',
      'LOOKUP_LIMIT',
    ],
  })
  code: string;
}

export class ImportReportDto {
  @ApiProperty() rowsRead: number;
  @ApiProperty() pricesSaved: number;
  @ApiProperty() productsCreated: number;
  @ApiProperty({ type: [ImportRowErrorDto] }) errors: ImportRowErrorDto[];
}

export class DivergenceDto {
  @ApiProperty() productId: string;
  @ApiProperty() canonicalName: string;
  @ApiProperty() merchantPrice: number;
  @ApiProperty() receiptPrice: number;
  @ApiProperty({ format: 'date-time' }) receiptAt: string;
  @ApiProperty({ description: '(receipt − merchant) / merchant' })
  difference: number;
}

export class DemandItemDto {
  @ApiProperty() productId: string;
  @ApiProperty() canonicalName: string;
  @ApiProperty({
    description: 'Lists in the area over 7 days (only shown when ≥ 10)',
  })
  lists: number;
  @ApiProperty({ description: 'The store sells it' }) listed: boolean;
}

export class StoreOverviewDto {
  @ApiProperty() productsListed: number;
  @ApiProperty() activeOffers: number;
  @ApiProperty({ description: 'Products cheaper than the regional median' })
  belowMedian: number;
  @ApiProperty({ description: 'Products pricier than the regional median' })
  aboveMedian: number;
  @ApiProperty({ type: [DivergenceDto] }) divergences: DivergenceDto[];
  @ApiProperty({ type: [DemandItemDto] }) demand: DemandItemDto[];
}

export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_LOOKUPS = 50;
export const IMPORT_MAX_BYTES = 1024 * 1024;
