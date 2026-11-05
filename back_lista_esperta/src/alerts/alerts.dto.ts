import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PointDto } from '../verdict/verdict.dto.js';

export class PushKeysDto {
  @ApiProperty() @IsString() @Length(10, 200) p256dh: string;
  @ApiProperty() @IsString() @Length(5, 100) auth: string;
}

/** The browser's PushSubscription.toJSON(). */
export class PushSubscriptionDto {
  @ApiProperty()
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  @MaxLength(1000)
  endpoint: string;

  @ApiProperty({ type: PushKeysDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

export class PushEndpointDto {
  @ApiProperty() @IsString() @MaxLength(1000) endpoint: string;
}

export class PushPublicKeyDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'VAPID public key; null when push is not configured',
  })
  publicKey: string | null;
}

export class PushTestResultDto {
  @ApiProperty() sent: number;
}

export class CreateAlertDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;

  @ApiProperty({ example: 4.99, description: 'Notify at this price or less' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  targetPrice: number;

  @ApiProperty({ type: PointDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PointDto)
  origin: PointDto;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  radiusKm?: number;
}

export class UpdateAlertDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  targetPrice?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  radiusKm?: number;
}

export class AlertProductDto {
  @ApiProperty() id: string;
  @ApiProperty() canonicalName: string;
}

export class AlertBestPriceDto {
  @ApiProperty() price: number;
  @ApiProperty() storeId: string;
  @ApiProperty() storeName: string;
  @ApiProperty() distanceKm: number;
  @ApiProperty({ enum: ['NFCE', 'MERCHANT', 'FLYER', 'COMMUNITY'] })
  source: 'NFCE' | 'MERCHANT' | 'FLYER' | 'COMMUNITY';
}

export class PriceAlertDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: AlertProductDto }) product: AlertProductDto;
  @ApiProperty() targetPrice: number;
  @ApiProperty() radiusKm: number;
  @ApiProperty({ type: PointDto }) origin: PointDto;
  @ApiProperty() active: boolean;
  @ApiProperty({
    type: AlertBestPriceDto,
    nullable: true,
    description: 'Lowest current price in the area',
  })
  best: AlertBestPriceDto | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  notifiedAt: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}
