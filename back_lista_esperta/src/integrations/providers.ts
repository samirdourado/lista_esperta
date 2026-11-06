import type { Cell } from '../common/geo-cell.js';
import type { PlaceCandidate, StoreAddress } from '../stores/store.types.js';

/**
 * Finds shops inside a map cell. Today: OpenStreetMap (Overpass).
 * A Google Places implementation can replace it without touching callers.
 */
export interface PlacesProvider {
  readonly source: 'OSM' | 'GOOGLE_PLACES';
  fetchArea(cell: Cell): Promise<PlaceCandidate[]>;
}
export const PLACES_PROVIDER = Symbol('PLACES_PROVIDER');

export interface GeocodedPlace {
  label: string;
  lat: number;
  lng: number;
  address: StoreAddress;
}

/** Address ↔ coordinates. Today: Nominatim (OpenStreetMap). */
export interface GeocodingProvider {
  search(query: string): Promise<GeocodedPlace[]>;
  reverse(lat: number, lng: number): Promise<GeocodedPlace | null>;
}
export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');

/** Public company record from the Receita Federal. */
export interface CompanyRecord {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  /** "ATIVA", "BAIXADA", "SUSPENSA"… */
  registrationStatus: string;
  address: StoreAddress;
}

/** Today: BrasilAPI. Returns null when the CNPJ does not exist. */
export interface CnpjLookup {
  find(cnpj: string): Promise<CompanyRecord | null>;
}
export const CNPJ_LOOKUP = Symbol('CNPJ_LOOKUP');

/** Street and district of a CEP (Correios). Coordinates come from the geocoder. */
export interface CepAddress {
  cep: string;
  street: string | null;
  district: string | null;
  city: string;
  state: string;
}

/** Today: BrasilAPI. Returns null when the CEP does not exist. */
export interface CepLookup {
  find(cep: string): Promise<CepAddress | null>;
}
export const CEP_LOOKUP = Symbol('CEP_LOOKUP');
