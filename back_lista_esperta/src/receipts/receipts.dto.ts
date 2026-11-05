import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class QrReceiptDto {
  @ApiProperty({
    example:
      'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=35261111222333000181650010000123451123456780|2|1|1|ABC',
    description: 'The text inside the receipt QR code',
  })
  @IsString()
  @Length(20, 1000)
  url: string;
}

export class AccessKeyDto {
  @ApiProperty({
    example: '3526 1111 2223 3300 0181 6500 1000 0123 4511 2345 6780',
  })
  @IsString()
  @Matches(/^[\d\s.-]{44,60}$/)
  accessKey: string;
}

export class AccessKeyInfoDto {
  @ApiProperty() valid: boolean;
  @ApiProperty({ nullable: true, type: String }) uf: string | null;
  @ApiProperty({ nullable: true, type: String }) cnpj: string | null;
  @ApiProperty({ nullable: true, type: String, example: '2026-11' }) month:
    string | null;
  @ApiProperty({ description: 'This state can be read from the QR code' })
  supported: boolean;
  @ApiProperty({ description: 'Already sent by someone' }) alreadySent: boolean;
  @ApiProperty({
    nullable: true,
    type: String,
    enum: ['LENGTH', 'CHECK_DIGIT', 'UF', 'MODEL'],
  })
  error: string | null;
}

export class ReceiptLineResultDto {
  @ApiProperty() description: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unit: string;
  @ApiProperty() unitPrice: number;
  @ApiProperty() totalPrice: number;
  @ApiProperty({
    enum: ['MATCHED', 'PENDING', 'UNMATCHED'],
    description: 'MATCHED lines became prices',
  })
  status: 'MATCHED' | 'PENDING' | 'UNMATCHED';
  @ApiProperty({ nullable: true, type: String }) productName: string | null;
}

export class ReceiptStoreDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Bom Preço' }) name: string;
}

export class ReceiptResultDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() accessKey: string;
  @ApiProperty({ type: () => ReceiptStoreDto }) store: ReceiptStoreDto;
  @ApiProperty({ format: 'date-time' }) issuedAt: string;
  @ApiProperty() total: number;
  @ApiProperty({ description: 'Prices added to the shared base' })
  pricesAdded: number;
  @ApiProperty({ enum: ['SEFAZ', 'PHOTO'] }) source: 'SEFAZ' | 'PHOTO';
  @ApiProperty({ type: [ReceiptLineResultDto] }) lines: ReceiptLineResultDto[];
}
