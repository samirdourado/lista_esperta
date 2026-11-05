import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import type { StoreAddress } from '../../stores/store.types.js';
import { ExternalServiceError, fetchJson } from '../http.js';
import type { GeocodedPlace, GeocodingProvider } from '../providers.js';

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string | undefined>;
}

/** Nominatim's address object → our StoreAddress. */
export function toGeocodedPlace(result: NominatimResult): GeocodedPlace {
  const a = result.address ?? {};
  const state = a['ISO3166-2-lvl4']?.match(/^BR-([A-Z]{2})$/)?.[1];
  const address: StoreAddress = Object.fromEntries(
    Object.entries({
      street: a.road ?? a.pedestrian,
      number: a.house_number,
      district: a.suburb ?? a.neighbourhood ?? a.city_district,
      city: a.city ?? a.town ?? a.village ?? a.municipality,
      state,
      postcode: a.postcode,
    }).filter(([, value]) => value),
  );
  return {
    label: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon),
    address,
  };
}

const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

/**
 * The public Nominatim allows one request per second and asks for caching
 * (https://operations.osmfoundation.org/policies/nominatim/). Requests are
 * serialized with a minimum gap and answers are cached for a day.
 */
@Injectable()
export class NominatimGeocodingProvider implements GeocodingProvider {
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;
  private readonly cache = new Map<string, { at: number; value: unknown }>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  search(query: string): Promise<GeocodedPlace[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'br',
      limit: '5',
      'accept-language': 'pt-BR',
    });
    return this.cached(`s:${query.toLowerCase()}`, async () => {
      const results = await this.call<NominatimResult[]>(
        `search?${params.toString()}`,
      );
      return (results ?? []).map(toGeocodedPlace);
    });
  }

  reverse(lat: number, lng: number): Promise<GeocodedPlace | null> {
    const params = new URLSearchParams({
      lat: lat.toFixed(6),
      lon: lng.toFixed(6),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '18',
      'accept-language': 'pt-BR',
    });
    return this.cached(`r:${lat.toFixed(5)},${lng.toFixed(5)}`, async () => {
      const result = await this.call<NominatimResult & { error?: string }>(
        `reverse?${params.toString()}`,
      );
      return result && !result.error ? toGeocodedPlace(result) : null;
    });
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
    const value = await load();
    if (this.cache.size >= CACHE_MAX) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  private call<T>(path: string): Promise<T | null> {
    const run = async () => {
      const wait = this.lastCall + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastCall = Date.now();
      const base = this.config.get('NOMINATIM_URL', { infer: true });
      const { status, body } = await fetchJson<T>(
        'nominatim',
        `${base}/${path}`,
        {
          timeoutMs: 10_000,
          userAgent: this.config.get('HTTP_USER_AGENT', { infer: true }),
        },
      );
      if (body === null && status !== 404) {
        throw new ExternalServiceError('nominatim', status, `HTTP ${status}`);
      }
      return body;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
