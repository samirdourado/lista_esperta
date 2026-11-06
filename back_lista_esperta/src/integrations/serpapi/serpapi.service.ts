import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { ExternalServiceError, fetchJson } from '../http.js';

/** One offer on Google Shopping, as the provider returns it. */
export interface WebShoppingOffer {
  position: number;
  title: string;
  price: number;
  store: string;
  thumbnail: string | null;
  url: string | null;
  delivery: string | null;
  /** Google's own hint, e.g. "Perto, 2 km" or "Retire hoje". */
  nearby: string | null;
}

export interface WebShoppingSearch {
  readonly enabled: boolean;
  search(query: string, location: string | null): Promise<WebShoppingOffer[]>;
  /** Google's name for the place nearest to the person, or null. */
  locate(city: string, lat: number, lng: number): Promise<string | null>;
}
export const WEB_SHOPPING = Symbol('WEB_SHOPPING');

interface ShoppingResponse {
  error?: string;
  shopping_results?: {
    position?: number;
    title?: string;
    source?: string;
    extracted_price?: number;
    thumbnail?: string;
    product_link?: string;
    delivery?: string;
    extensions?: string[];
  }[];
}

interface SerpLocation {
  canonical_name: string;
  country_code: string;
  gps?: [number, number];
}

const NEARBY = /perto|próxim|retir|na loja|in store|nearby|\bkm\b/i;

/** Squared distance is enough to pick the closest candidate. */
const closeness = (
  gps: [number, number] | undefined,
  lat: number,
  lng: number,
) =>
  gps ? (gps[0] - lng) ** 2 + (gps[1] - lat) ** 2 : Number.POSITIVE_INFINITY;

/**
 * Google Shopping through SerpApi (https://serpapi.com/google-shopping-api).
 * Free plan: 250 searches a month; SerpApi's own one-hour cache is free.
 */
@Injectable()
export class SerpApiService implements WebShoppingSearch {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return Boolean(this.config.get('SERPAPI_API_KEY', { infer: true }));
  }

  private get base(): string {
    return this.config.get('SERPAPI_URL', { infer: true });
  }

  private get userAgent(): string {
    return this.config.get('HTTP_USER_AGENT', { infer: true });
  }

  async search(
    query: string,
    location: string | null,
  ): Promise<WebShoppingOffer[]> {
    const key = this.config.get('SERPAPI_API_KEY', { infer: true });
    if (!key)
      throw new ExternalServiceError(
        'serpapi',
        null,
        'SERPAPI_API_KEY is not set',
      );
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: query,
      gl: 'br',
      hl: 'pt-br',
      google_domain: 'google.com.br',
      api_key: key,
    });
    if (location) params.set('location', location);
    const { status, body } = await fetchJson<ShoppingResponse>(
      'serpapi',
      `${this.base}/search.json?${params}`,
      { timeoutMs: 20_000, userAgent: this.userAgent },
    );
    if (!body)
      throw new ExternalServiceError('serpapi', status, `HTTP ${status}`);
    // "Google hasn't returned any results" comes as 200 + error.
    if (body.error && !body.shopping_results) return [];
    return (body.shopping_results ?? []).flatMap((item, index) => {
      if (!item.title || !item.source || !(Number(item.extracted_price) > 0))
        return [];
      return [
        {
          position: item.position ?? index + 1,
          title: item.title,
          price: Math.round(Number(item.extracted_price) * 100) / 100,
          store: item.source,
          thumbnail: item.thumbnail ?? null,
          url: item.product_link ?? null,
          delivery: item.delivery ?? null,
          nearby: item.extensions?.find((text) => NEARBY.test(text)) ?? null,
        },
      ];
    });
  }

  /** Locations API (free, does not use the monthly quota). */
  async locate(city: string, lat: number, lng: number): Promise<string | null> {
    const params = new URLSearchParams({ q: city, limit: '10' });
    const { body } = await fetchJson<SerpLocation[]>(
      'serpapi',
      `${this.base}/locations.json?${params}`,
      { timeoutMs: 8_000, userAgent: this.userAgent },
    );
    const best = (body ?? [])
      .filter((place) => place.country_code === 'BR')
      .sort(
        (a, b) => closeness(a.gps, lat, lng) - closeness(b.gps, lat, lng),
      )[0];
    return best?.canonical_name ?? null;
  }
}
