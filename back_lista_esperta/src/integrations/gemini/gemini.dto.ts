import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { UNITS } from '../../products/products.dto.js';

/** Gemini output for one receipt line (spec section 8, "Normalização"). */
export class NormalizedProductDto {
  @IsInt() @Min(0) index: number;
  @IsString() @Length(2, 200) canonical_name: string;
  @IsOptional() @IsString() @Length(1, 80) brand?: string | null;
  @IsString() @Length(2, 60) category_slug: string;
  @IsIn(UNITS.map((unit) => unit.toLowerCase())) unit: string;
  @IsNumber() @Min(0.001) @Max(100000) unit_quantity: number;
  @IsOptional() @Matches(/^\d{8,14}$/) gtin?: string | null;
  @IsNumber() @Min(0) @Max(1) confidence: number;
}

export class NormalizedBatchDto {
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => NormalizedProductDto)
  items: NormalizedProductDto[];
}

export class ExtractedLineDto {
  @IsString() @Length(1, 200) description: string;
  @IsOptional() @IsString() @Length(1, 20) code?: string | null;
  @IsNumber() @Min(0.001) @Max(10000) quantity: number;
  @IsString() @Length(1, 6) unit: string;
  @IsNumber() @Min(0) @Max(1000000) unit_price: number;
  @IsNumber() @Min(0) @Max(1000000) total_price: number;
}

/** Gemini output for a receipt photo. */
export class ExtractedReceiptDto {
  @IsOptional() @IsString() access_key?: string | null;
  @IsString() @Length(1, 200) store_name: string;
  @IsOptional() @IsString() cnpj?: string | null;
  @IsOptional() @IsString() @Length(0, 300) address?: string | null;
  @IsString() issued_at: string;
  @IsNumber() @Min(0) total: number;
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => ExtractedLineDto)
  lines: ExtractedLineDto[];
}

/** JSON schemas sent as responseSchema (OpenAPI subset understood by Gemini). */
export const NORMALIZE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER' },
          canonical_name: { type: 'STRING' },
          brand: { type: 'STRING', nullable: true },
          category_slug: { type: 'STRING' },
          unit: {
            type: 'STRING',
            enum: ['un', 'g', 'kg', 'ml', 'l', 'm', 'm2'],
          },
          unit_quantity: { type: 'NUMBER' },
          gtin: { type: 'STRING', nullable: true },
          confidence: { type: 'NUMBER' },
        },
        required: [
          'index',
          'canonical_name',
          'category_slug',
          'unit',
          'unit_quantity',
          'confidence',
        ],
      },
    },
  },
  required: ['items'],
} as const;

export const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    access_key: {
      type: 'STRING',
      nullable: true,
      description: '44 digits, no spaces',
    },
    store_name: { type: 'STRING' },
    cnpj: { type: 'STRING', nullable: true },
    address: { type: 'STRING', nullable: true },
    issued_at: { type: 'STRING', description: 'ISO 8601 with -03:00 offset' },
    total: { type: 'NUMBER' },
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          code: { type: 'STRING', nullable: true },
          quantity: { type: 'NUMBER' },
          unit: { type: 'STRING' },
          unit_price: { type: 'NUMBER' },
          total_price: { type: 'NUMBER' },
        },
        required: [
          'description',
          'quantity',
          'unit',
          'unit_price',
          'total_price',
        ],
      },
    },
  },
  required: ['store_name', 'issued_at', 'total', 'lines'],
} as const;

export class ListLineDto {
  @IsString() @Length(1, 200) text: string;
  @IsNumber() @Min(0.001) @Max(999) quantity: number;
}

/** Gemini output for a photo of a shopping list (handwritten or printed). */
export class ExtractedListDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ListLineDto)
  lines: ListLineDto[];
}

export const LIST_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { text: { type: 'STRING' }, quantity: { type: 'NUMBER' } },
        required: ['text', 'quantity'],
      },
    },
  },
  required: ['lines'],
} as const;
