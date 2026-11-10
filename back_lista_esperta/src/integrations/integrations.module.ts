import { Global, Module } from '@nestjs/common';
import {
  BrasilApiCepLookup,
  BrasilApiCnpjLookup,
} from './brasil-api/brasil-api.provider.js';
import {
  PRICE_DIRECTORY,
  PrecoMelhorService,
} from './precomelhor/precomelhor.service.js';
import { NominatimGeocodingProvider } from './nominatim/nominatim.provider.js';
import { OverpassPlacesProvider } from './osm/overpass.provider.js';
import {
  CEP_LOOKUP,
  CNPJ_LOOKUP,
  GEOCODING_PROVIDER,
  PLACES_PROVIDER,
} from './providers.js';

/**
 * Free third-party services (docs/DECISIONS.md D-031). Callers depend on the
 * tokens, so a paid provider can replace any of them in one line.
 */
@Global()
@Module({
  providers: [
    { provide: PLACES_PROVIDER, useClass: OverpassPlacesProvider },
    { provide: GEOCODING_PROVIDER, useClass: NominatimGeocodingProvider },
    { provide: CNPJ_LOOKUP, useClass: BrasilApiCnpjLookup },
    { provide: CEP_LOOKUP, useClass: BrasilApiCepLookup },
    { provide: PRICE_DIRECTORY, useClass: PrecoMelhorService },
  ],
  exports: [
    PLACES_PROVIDER,
    GEOCODING_PROVIDER,
    CNPJ_LOOKUP,
    CEP_LOOKUP,
    PRICE_DIRECTORY,
  ],
})
export class IntegrationsModule {}
