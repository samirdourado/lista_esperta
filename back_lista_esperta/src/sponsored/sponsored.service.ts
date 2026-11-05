import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class SponsoredItemDto {
  @ApiProperty() storeId: string;
  @ApiProperty() storeName: string;
  @ApiProperty() title: string;
  @ApiProperty({ example: 'Patrocinado' }) label: 'Patrocinado';
}

/**
 * Paid placements (spec section 7). They are chosen AFTER the verdict and
 * shown in a separate block labelled "Patrocinado"; they never feed the
 * engine. No paid product exists yet, so this returns nothing; the seam and
 * the neutrality test are in place for when it does.
 */
@Injectable()
export class SponsoredService {
  forVerdict(_context: {
    storeIds: string[];
    productIds: string[];
  }): Promise<SponsoredItemDto[]> {
    return Promise.resolve([]);
  }
}
