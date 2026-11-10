import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class WebPriceQueryDto {
  @ApiProperty({ example: 'leite integral 1l' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  q: string;

  @ApiPropertyOptional({ example: -23.5891 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: -46.6346 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;
}

export class WebOfferDto {
  @ApiProperty({ example: 'Leite UHT Integral Italac 1L' }) title: string;
  @ApiProperty({ example: 4.79 }) price: number;
  @ApiProperty({ example: 'Carrefour' }) store: string;
  @ApiProperty({ nullable: true, type: String }) thumbnail: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Google Shopping page',
  })
  url: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Frete grátis' })
  delivery: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: "Google's local hint, e.g. 'Perto, 2 km'",
  })
  nearby: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Barcode' })
  ean: string | null;
}

export class WebPriceResponseDto {
  @ApiProperty() query: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Sao Paulo',
    description: 'City Google used; null when the location was not known',
  })
  location: string | null;
  @ApiProperty({ type: [WebOfferDto], description: 'Cheapest first' })
  offers: WebOfferDto[];
  @ApiProperty({ format: 'date-time' }) searchedAt: string;
  @ApiProperty({ enum: ['PRECOMELHOR', 'GOOGLE'] })
  source: 'PRECOMELHOR' | 'GOOGLE';
}
