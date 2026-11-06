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
  CEP_LOOKUP,
  type CepLookup,
  GEOCODING_PROVIDER,
  type GeocodedPlace,
  type GeocodingProvider,
} from '../integrations/providers.js';
import { AddressDto, PointQueryDto } from '../stores/stores.dto.js';

export class GeocodeSearchQueryDto {
  @ApiProperty({
    example: 'Rua Domingos de Morais 2000, São Paulo',
    description: 'An address, or a CEP (8 digits, with or without the dash)',
  })
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
    @Inject(CEP_LOOKUP) private readonly ceps: CepLookup,
  ) {}

  @Get('search')
  @ApiOkResponse({ type: [GeocodedPlaceDto] })
  @ApiServiceUnavailableResponse()
  search(@Query() query: GeocodeSearchQueryDto): Promise<GeocodedPlaceDto[]> {
    const cep = query.q.replace(/[\s.-]/g, '');
    if (/^\d{8}$/.test(cep)) return this.guard(() => this.searchCep(cep));
    return this.guard(() => this.geocoding.search(query.q));
  }

  /**
   * CEP → street and district (BrasilAPI) → coordinates of that street
   * (Nominatim). The street is enough to compare stores within a few km.
   */
  private async searchCep(cep: string): Promise<GeocodedPlace[]> {
    const found = await this.ceps.find(cep);
    if (!found) return [];
    const area = [found.city, found.state].join(', ');
    const tries = [
      found.street && `${found.street}, ${area}`,
      found.district && `${found.district}, ${area}`,
    ].filter((q): q is string => Boolean(q));
    for (const q of tries) {
      const [place] = await this.geocoding.search(q);
      if (!place) continue;
      const postcode = `${cep.slice(0, 5)}-${cep.slice(5)}`;
      return [
        {
          ...place,
          label: [
            found.street,
            found.district,
            `${found.city} - ${found.state}`,
            postcode,
          ]
            .filter(Boolean)
            .join(', '),
          address: {
            ...place.address,
            ...(found.street ? { street: found.street } : {}),
            ...(found.district ? { district: found.district } : {}),
            city: found.city,
            state: found.state,
            postcode,
          },
        },
      ];
    }
    return [];
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
