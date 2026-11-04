import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  ShoppingList,
  ShoppingListItem,
} from '../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const MAX_ITEMS_PER_LIST = 200;
export const MAX_LISTS_PER_IMPORT = 50;

export class ShoppingListItemInputDto {
  @ApiProperty({ example: 'arroz 5kg' })
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  freeText: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999)
  quantity?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Catalogue product, when matched',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class UpsertShoppingListDto {
  @ApiProperty({ example: 'Compras da semana' })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiProperty({ type: [ShoppingListItemInputDto] })
  @IsArray()
  @ArrayMaxSize(MAX_ITEMS_PER_LIST)
  @ValidateNested({ each: true })
  @Type(() => ShoppingListItemInputDto)
  items: ShoppingListItemInputDto[];
}

export class ImportedShoppingListDto extends UpsertShoppingListDto {
  @ApiProperty({ description: 'Id the list has on the device (IndexedDB)' })
  @IsString()
  @Length(1, 64)
  clientId: string;
}

export class ImportShoppingListsDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Device guest id; its receipts and prices move to the account',
  })
  @IsOptional()
  @IsUUID('4')
  guestId?: string;

  @ApiProperty({ type: [ImportedShoppingListDto] })
  @IsArray()
  @ArrayMaxSize(MAX_LISTS_PER_IMPORT)
  @ValidateNested({ each: true })
  @Type(() => ImportedShoppingListDto)
  lists: ImportedShoppingListDto[];
}

export class ShoppingListItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  freeText: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  productId: string | null;
}

export class ShoppingListResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ nullable: true, type: String })
  clientId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: [ShoppingListItemResponseDto] })
  items: ShoppingListItemResponseDto[];

  static from(
    list: ShoppingList & { items: ShoppingListItem[] },
  ): ShoppingListResponseDto {
    return {
      id: list.id,
      clientId: list.clientId,
      name: list.name,
      updatedAt: list.updatedAt.toISOString(),
      items: list.items
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          id: item.id,
          freeText: item.freeText,
          quantity: item.quantity.toNumber(),
          productId: item.productId,
        })),
    };
  }
}

export class ImportShoppingListsResponseDto {
  @ApiProperty({
    type: [ShoppingListResponseDto],
    description: 'All lists of the account after the import',
  })
  lists: ShoppingListResponseDto[];

  @ApiProperty({
    description:
      'Lists created by this import (already imported ones are skipped)',
  })
  imported: number;

  @ApiProperty({
    description: 'Receipts sent as guest that now belong to the account',
  })
  receiptsClaimed: number;

  @ApiProperty({
    description:
      'Community prices sent as guest that now belong to the account',
  })
  pricesClaimed: number;
}
