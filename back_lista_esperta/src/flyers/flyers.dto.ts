import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, MaxLength } from 'class-validator';

export class ImportFlyerDto {
  @ApiProperty({
    example: 'https://www.mercado.com.br/encarte-da-semana.pdf',
    description: 'Public link of the store flyer (page or PDF)',
  })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  url: string;
}

export class FlyerItemResultDto {
  @ApiProperty() description: string;
  @ApiProperty() price: number;
  @ApiProperty({ enum: ['MATCHED', 'PENDING', 'UNMATCHED'] })
  status: 'MATCHED' | 'PENDING' | 'UNMATCHED';
  @ApiProperty({ type: String, nullable: true }) productName: string | null;
}

export class FlyerImportDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiProperty({ type: String, nullable: true }) title: string | null;
  @ApiProperty({ enum: ['DONE', 'FAILED'] }) status: 'DONE' | 'FAILED';
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  validUntil: string | null;
  @ApiProperty() itemsFound: number;
  @ApiProperty() pricesAdded: number;
  @ApiProperty({
    description: 'Items waiting for an admin to confirm the product',
  })
  pending: number;
  @ApiProperty({ type: String, nullable: true }) error: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: [FlyerItemResultDto] }) items: FlyerItemResultDto[];
}
