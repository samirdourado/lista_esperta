import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { MeasureUnit } from '../generated/prisma/enums.js';
import type { Product } from '../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const UNITS = ['UN', 'G', 'KG', 'ML', 'L', 'M', 'M2'] as const;

export class ProductSearchQueryDto {
  @ApiPropertyOptional({
    description: 'Name to search (similar names match too)',
    example: 'leite integral',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  q?: string;

  @ApiPropertyOptional({ example: '7891000100103' })
  @IsOptional()
  @Matches(/^\d{8,14}$/)
  gtin?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class CreateProductDto {
  @ApiPropertyOptional({ example: '7891000100103' })
  @IsOptional()
  @Matches(/^\d{8,14}$/)
  gtin?: string;

  @ApiProperty({ example: 'Leite condensado integral 395 g' })
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  canonicalName: string;

  @ApiPropertyOptional({ example: 'Moça' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  brand?: string;

  @ApiProperty({ example: 'laticinios' })
  @IsString()
  categorySlug: string;

  @ApiProperty({ enum: UNITS, enumName: 'MeasureUnit' })
  @IsIn(UNITS)
  unit: MeasureUnit;

  @ApiProperty({ example: 395 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100000)
  unitQuantity: number;
}

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ nullable: true, type: String }) gtin: string | null;
  @ApiProperty() canonicalName: string;
  @ApiProperty({ nullable: true, type: String }) brand: string | null;
  @ApiProperty() categorySlug: string;
  @ApiProperty({ enum: UNITS, enumName: 'MeasureUnit' }) unit: MeasureUnit;
  @ApiProperty() unitQuantity: number;

  static from(
    product: Product & { category: { slug: string } },
  ): ProductResponseDto {
    return {
      id: product.id,
      gtin: product.gtin,
      canonicalName: product.canonicalName,
      brand: product.brand,
      categorySlug: product.category.slug,
      unit: product.unit,
      unitQuantity: product.unitQuantity.toNumber(),
    };
  }
}

export class ProductSuggestionDto {
  @ApiProperty() gtin: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String }) brand: string | null;
  @ApiProperty({ enum: UNITS, nullable: true }) unit: MeasureUnit | null;
  @ApiProperty({ nullable: true, type: Number }) unitQuantity: number | null;
  @ApiProperty({ nullable: true, type: String }) categorySlug: string | null;
  @ApiProperty({ enum: ['OPEN_FOOD_FACTS'] }) source: 'OPEN_FOOD_FACTS';
}

export class ProductLookupResponseDto {
  @ApiPropertyOptional({
    type: ProductResponseDto,
    nullable: true,
    description: 'Already in the catalog',
  })
  product: ProductResponseDto | null;
  @ApiPropertyOptional({
    type: ProductSuggestionDto,
    nullable: true,
    description: 'Found in Open Food Facts; confirm to create',
  })
  suggestion: ProductSuggestionDto | null;
}

export class CategoryNodeDto {
  @ApiProperty() slug: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: () => [CategoryNodeDto] }) children: CategoryNodeDto[];
}
