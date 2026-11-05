import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { ClaimStatus } from '../generated/prisma/enums.js';
import {
  StoreResponseDto,
  VerificationResponseDto,
} from '../stores/stores.dto.js';

export class CreateStoreClaimDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storeId: string;

  @ApiPropertyOptional({
    example: '11.222.333/0001-81',
    description: 'When it matches the store, the claim is approved right away',
  })
  @IsOptional()
  @IsString()
  @Length(14, 18)
  cnpj?: string;

  @ApiPropertyOptional({ example: 'Sou o dono desde 2015.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class StoreClaimResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ClaimStatus, enumName: 'ClaimStatus' })
  status: ClaimStatus;
  @ApiProperty({ nullable: true, type: String }) message: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: StoreResponseDto }) store: StoreResponseDto;
}

export class CreateStoreClaimResponseDto {
  @ApiProperty({ type: StoreClaimResponseDto }) claim: StoreClaimResponseDto;
  @ApiProperty({
    description: 'Approved on the spot because the CNPJ matched the store',
  })
  autoApproved: boolean;
  @ApiPropertyOptional({ type: VerificationResponseDto, nullable: true })
  verification: VerificationResponseDto | null;
}

export class AdminClaimQueryDto {
  @ApiPropertyOptional({ enum: ClaimStatus, default: 'PENDING' })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status: ClaimStatus = 'PENDING';
}

export class AdminStoreClaimResponseDto extends StoreClaimResponseDto {
  @ApiProperty({
    example: { id: 'uuid', email: 'loja@example.com', displayName: 'Loja' },
  })
  user: { id: string; email: string; displayName: string };
}
