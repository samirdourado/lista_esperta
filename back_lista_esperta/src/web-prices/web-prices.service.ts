import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExternalServiceError } from '../integrations/http.js';
import {
  GEOCODING_PROVIDER,
  type GeocodingProvider,
} from '../integrations/providers.js';
import {
  WEB_SHOPPING,
  type WebShoppingOffer,
  type WebShoppingSearch,
} from '../integrations/serpapi/serpapi.service.js';
import type {
  WebOfferDto,
  WebPriceQueryDto,
  WebPriceResponseDto,
} from './web-prices.dto.js';

/** Most relevant results Google returns; the cheapest among them are shown. */
const RELEVANT = 20;
const SHOWN = 6;
const SEARCH_TTL_MS = 6 * 60 * 60 * 1000;
const PLACE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 300;

/** Small TTL cache: the free plan has 250 searches a month (D-070). */
class TtlCache<T> {
  private readonly entries = new Map<string, { at: number; value: T }>();
  constructor(private readonly ttlMs: number) {}

  get(key: string, now: number): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (now - hit.at > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, now: number): void {
    if (this.entries.size >= CACHE_MAX)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { at: now, value });
  }
}

/** Relevance first, then price: the cheapest of what Google found most relevant. */
export function pickCheapest(offers: WebShoppingOffer[]): WebOfferDto[] {
  const seen = new Set<string>();
  return [...offers]
    .sort((a, b) => a.position - b.position)
    .slice(0, RELEVANT)
    .sort((a, b) => a.price - b.price || a.position - b.position)
    .filter((offer) => {
      const key = `${offer.store}|${offer.title}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, SHOWN)
    .map((offer) => ({
      title: offer.title,
      price: offer.price,
      store: offer.store,
      thumbnail: offer.thumbnail,
      url: offer.url,
      delivery: offer.delivery,
      nearby: offer.nearby,
    }));
}

@Injectable()
export class WebPricesService {
  private readonly logger = new Logger(WebPricesService.name);
  private readonly searches = new TtlCache<WebOfferDto[]>(SEARCH_TTL_MS);
  private readonly places = new TtlCache<{
    city: string | null;
    google: string | null;
  }>(PLACE_TTL_MS);

  constructor(
    @Inject(WEB_SHOPPING) private readonly shopping: WebShoppingSearch,
    @Inject(GEOCODING_PROVIDER) private readonly geocoding: GeocodingProvider,
  ) {}

  async search(
    input: WebPriceQueryDto,
    now = new Date(),
  ): Promise<WebPriceResponseDto> {
    if (!this.shopping.enabled)
      throw new ServiceUnavailableException({
        code: 'WEB_SEARCH_UNAVAILABLE',
        message: 'Web price search is not configured',
      });
    const query = input.q.replace(/\s+/g, ' ').trim();
    const place =
      input.lat !== undefined && input.lng !== undefined
        ? await this.placeOf(input.lat, input.lng, now.getTime())
        : { city: null, google: null };

    const key = `${query.toLowerCase()}|${place.google ?? ''}`;
    let offers = this.searches.get(key, now.getTime());
    if (!offers) {
      try {
        offers = pickCheapest(await this.shopping.search(query, place.google));
      } catch (error) {
        if (!(error instanceof ExternalServiceError)) throw error;
        this.logger.warn(`Web price search failed: ${error.message}`);
        if (error.status === 429)
          throw new HttpException(
            {
              code: 'WEB_SEARCH_QUOTA',
              message: 'The monthly web search quota is used up',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        throw new ServiceUnavailableException({
          code: 'WEB_SEARCH_FAILED',
          message: 'Web price search did not answer',
        });
      }
      this.searches.set(key, offers, now.getTime());
    }
    return {
      query,
      location: place.city,
      offers,
      searchedAt: now.toISOString(),
    };
  }

  /** Coordinates → city (Nominatim) → Google's place name. Never fails the search. */
  private async placeOf(lat: number, lng: number, now: number) {
    const cell = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const cached = this.places.get(cell, now);
    if (cached) return cached;
    let place: { city: string | null; google: string | null } = {
      city: null,
      google: null,
    };
    try {
      const city =
        (await this.geocoding.reverse(lat, lng))?.address.city ?? null;
      const google = city ? await this.shopping.locate(city, lat, lng) : null;
      place = { city: google ? city : null, google };
    } catch (error) {
      this.logger.warn(
        `Could not place the web search: ${error instanceof Error ? error.message : String(error)}`,
      );
      return place; // not cached: try again next time
    }
    this.places.set(cell, place, now);
    return place;
  }
}
