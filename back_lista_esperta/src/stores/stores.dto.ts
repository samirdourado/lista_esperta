import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  StoreMemberRole,
  StoreSource,
  VerificationStatus,
} from '../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class AddressDto {
  @ApiPropertyOptional({ example: 'Rua Domingos de Morais' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  street?: string;

  @ApiPropertyOptional({ example: '2000' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  number?: string;

  @ApiPropertyOptional({ example: 'Vila Mariana' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  district?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'SP', description: 'Two-letter state code' })
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z]{2}$/)
  state?: string;

  @ApiPropertyOptional({ example: '04036-000' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{5}-?\d{3}$/)
  postcode?: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class TimeRangeDto {
  @ApiProperty({ example: '08:00' })
  @Matches(HHMM)
  open: string;

  @ApiProperty({
    example: '20:00',
    description: 'Earlier than open = closes after midnight',
  })
  @Matches(HHMM)
  close: string;
}

class DayHours {
  @ApiPropertyOptional({ type: [TimeRangeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  mon?: TimeRangeDto[];
  @ApiPropertyOptional({ type: [TimeRangeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  tue?: TimeRangeDto[];
  @ApiPropertyOptional({ type: [TimeRangeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  wed?: TimeRangeDto[];
  @ApiPropertyOptional({ type: [TimeRangeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  thu?: TimeRangeDto[];
  @ApiPropertyOptional({ type: [TimeRangeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  fri?: TimeRangeDto[];
  @ApiPropertyOptional({ type: [TimeRangeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  sat?: TimeRangeDto[];
  @ApiPropertyOptional({ type: [TimeRangeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  sun?: TimeRangeDto[];
}

export class OpeningHoursDto {
  @ApiPropertyOptional({
    description: 'Ranges per day; a day left out is closed',
    example: { mon: [{ open: '08:00', close: '20:00' }], sun: [] },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHours)
  weekly?: DayHours;
}

export class PointQueryDto {
  @ApiProperty({ example: -23.5891 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: -46.6346 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

export class NearbyQueryDto extends PointQueryDto {
  @ApiPropertyOptional({ default: 5, minimum: 0.5, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(20)
  radiusKm: number = 5;
}

export class ClaimableQueryDto extends PointQueryDto {
  @ApiPropertyOptional({ description: 'Store name, to rank by similarity' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  q?: string;
}

export class CreateStoreDto {
  @ApiProperty({ example: 'Mercado Bom Preço' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiPropertyOptional({
    example: '11.222.333/0001-81',
    description: 'Recommended: verifies the store',
  })
  @IsOptional()
  @IsString()
  @Length(14, 18)
  cnpj?: string;

  @ApiProperty({ example: -23.5891 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: -46.6346 })
  @IsLongitude()
  lng: number;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ApiPropertyOptional({ type: OpeningHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  openingHours?: OpeningHoursDto;

  @ApiPropertyOptional({ example: ['alimentos', 'limpeza'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  categorySlugs?: string[];

  @ApiPropertyOptional({
    description:
      'Set after the API answered 409 POSSIBLE_DUPLICATE and the merchant confirmed it is another store',
  })
  @IsOptional()
  @IsBoolean()
  confirmNotDuplicate?: boolean;
}

export class UpdateStoreDto extends PartialType(
  PickType(CreateStoreDto, [
    'name',
    'lat',
    'lng',
    'address',
    'openingHours',
    'categorySlugs',
  ] as const),
) {}

export class VerifyStoreDto {
  @ApiProperty({ example: '11.222.333/0001-81' })
  @IsString()
  @Length(14, 18)
  cnpj: string;
}

export class StoreResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String, example: '11222333000181' })
  cnpj: string | null;
  @ApiProperty({ enum: StoreSource, enumName: 'StoreSource' })
  source: StoreSource;
  @ApiProperty({ enum: VerificationStatus, enumName: 'VerificationStatus' })
  verificationStatus: VerificationStatus;
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty({ type: AddressDto, nullable: true }) address: AddressDto | null;
  @ApiProperty({
    nullable: true,
    description:
      '{ weekly } from the merchant or { osm } raw OpenStreetMap string',
    type: 'object',
    additionalProperties: true,
  })
  openingHours: Record<string, unknown> | null;
  @ApiProperty({ type: [String], example: ['alimentos'] }) categories: string[];
  @ApiProperty({ description: 'A merchant runs this store on the app' })
  managed: boolean;
  @ApiPropertyOptional({ example: 0.8 }) distanceKm?: number;
}

export class NearbyStoresResponseDto {
  @ApiProperty({ type: [StoreResponseDto] }) stores: StoreResponseDto[];
  @ApiProperty({
    description:
      'Map areas still being imported in the background; ask again in a few seconds',
    example: 0,
  })
  pendingAreas: number;
}

export class MyStoreResponseDto extends StoreResponseDto {
  @ApiProperty({ enum: StoreMemberRole, enumName: 'StoreMemberRole' })
  memberRole: StoreMemberRole;
}

export class VerificationChecksDto {
  @ApiProperty() active: boolean;
  @ApiProperty() sameState: boolean;
  @ApiProperty() sameCity: boolean;
  @ApiProperty() samePostcode: boolean;
  @ApiProperty() similarName: boolean;
}

export class VerificationResponseDto {
  @ApiProperty({ enum: ['VERIFIED', 'PENDING'] }) status:
    'VERIFIED' | 'PENDING';
  @ApiProperty({ type: VerificationChecksDto }) checks: VerificationChecksDto;
  @ApiProperty({ example: 'BOM PRECO SUPERMERCADOS LTDA' }) legalName: string;
  @ApiProperty({ nullable: true, type: String }) tradeName: string | null;
}

export class CreateStoreResponseDto {
  @ApiProperty({ type: StoreResponseDto }) store: StoreResponseDto;
  @ApiPropertyOptional({ type: VerificationResponseDto, nullable: true })
  verification: VerificationResponseDto | null;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Why the CNPJ could not be checked now',
  })
  verificationError: string | null;
}
