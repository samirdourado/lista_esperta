import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { Public } from '../auth/decorators.js';
import { ExternalServiceError } from '../integrations/http.js';
import {
  GEOCODING_PROVIDER,
  type GeocodingProvider,
} from '../integrations/providers.js';
import { AddressDto, PointQueryDto } from '../stores/stores.dto.js';

export class GeocodeSearchQueryDto {
  @ApiProperty({ example: 'Rua Domingos de Morais 2000, São Paulo' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 200)
  q: string;
}

export class GeocodedPlaceDto {
  @ApiProperty() label: string;
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty({ type: AddressDto }) address: AddressDto;
}

/** Nominatim allows 1 request/s for the whole app: keep clients well below it. */
const GEOCODING_THROTTLE = {
  ip: { limit: 20, ttl: 60_000 },
  default: { limit: 20, ttl: 60_000 },
};

/**
 * Address search for people who denied the location permission, and for the
 * store pin in the merchant onboarding.
 */
@ApiTags('geocoding')
@Public()
@Throttle(GEOCODING_THROTTLE)
@Controller('geocoding')
export class GeocodingController {
  constructor(
    @Inject(GEOCODING_PROVIDER) private readonly geocoding: GeocodingProvider,
  ) {}

  @Get('search')
  @ApiOkResponse({ type: [GeocodedPlaceDto] })
  @ApiServiceUnavailableResponse()
  search(@Query() query: GeocodeSearchQueryDto): Promise<GeocodedPlaceDto[]> {
    return this.guard(() => this.geocoding.search(query.q));
  }

  @Get('reverse')
  @ApiOkResponse({ type: GeocodedPlaceDto })
  @ApiServiceUnavailableResponse()
  async reverse(@Query() query: PointQueryDto): Promise<GeocodedPlaceDto> {
    const place = await this.guard(() =>
      this.geocoding.reverse(query.lat, query.lng),
    );
    if (!place) throw new NotFoundException('No address at this point');
    return place;
  }

  private async guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw new ServiceUnavailableException(
          'Address search is unavailable; try again shortly',
        );
      }
      throw error;
    }
  }
}
