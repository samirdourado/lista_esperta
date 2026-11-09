import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { distanceKm } from '../common/geo.js';
import { ExternalServiceError } from '../integrations/http.js';
import {
  pickCandidates,
  plausiblePrices,
  PRICE_DIRECTORY,
  type PriceDirectory,
} from '../integrations/precomelhor/precomelhor.service.js';
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
import {
  normalizeQuery,
  WebPricesRepository,
} from './web-prices.repository.js';

/** Most relevant results Google returns; the cheapest among them are shown. */
const RELEVANT = 20;
const SHOWN = 6;
/** "Perto de você" in the product search. */
const NEAR_KM = 10;
const DIRECTORY_FRESH_DAYS = 30;
/** Reference region when the person has not shared a location. */
const SAO_PAULO = { lat: -23.5505, lng: -46.6333 };
const PLACE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 300;

/** Small in-memory TTL cache for places (city lookups are cheap but rate-limited). */
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
      ean: null,
    }));
}

@Injectable()
export class WebPricesService {
  private readonly logger = new Logger(WebPricesService.name);
  private readonly places = new TtlCache<{
    city: string | null;
    google: string | null;
  }>(PLACE_TTL_MS);

  constructor(
    @Inject(WEB_SHOPPING) private readonly shopping: WebShoppingSearch,
    @Inject(GEOCODING_PROVIDER) private readonly geocoding: GeocodingProvider,
    private readonly repo: WebPricesRepository,
    @Inject(PRICE_DIRECTORY) private readonly directory: PriceDirectory,
  ) {}

  async search(
    input: WebPriceQueryDto,
    now = new Date(),
  ): Promise<WebPriceResponseDto> {
    const fromDirectory = await this.searchDirectory(input, now);
    if (fromDirectory) return fromDirectory;
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

    // The same words in the same place, searched by anyone in the last 48 h:
    // answer from the database and keep the monthly quota (D-076).
    const key = normalizeQuery(query);
    const saved = await this.repo.findFresh(key, place.google ?? '', now);
    if (saved) {
      return {
        query,
        location: place.city,
        offers: pickCheapest(saved.offers),
        searchedAt: saved.searchedAt.toISOString(),
        source: 'GOOGLE',
      };
    }

    let found: WebShoppingOffer[];
    try {
      found = await this.shopping.search(query, place.google);
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
    await this.repo.save({
      query: key,
      place: place.google ?? '',
      city: place.city,
      lat: input.lat,
      lng: input.lng,
      offers: found,
      now,
    });
    return {
      query,
      location: place.city,
      offers: pickCheapest(found),
      searchedAt: now.toISOString(),
      source: 'GOOGLE',
    };
  }

  /**
   * Products with barcode, photo and a price from physical stores (D-077):
   * the cheapest nearby when known, else the usual price in the country.
   * Null sends the search to Google.
   */
  private async searchDirectory(
    input: WebPriceQueryDto,
    now: Date,
  ): Promise<WebPriceResponseDto | null> {
    if (!this.directory.enabled) return null;
    const query = input.q.replace(/\s+/g, ' ').trim();
    const point =
      input.lat !== undefined && input.lng !== undefined
        ? { lat: input.lat, lng: input.lng }
        : null;
    const since = now.getTime() - DIRECTORY_FRESH_DAYS * 86_400_000;
    const products = pickCandidates(
      query,
      await this.directory.search(query),
      SHOWN,
    );
    const offers = (
      await Promise.all(
        products.map(async (product): Promise<WebOfferDto | null> => {
          const details = await this.directory.prices(product.ean);
          const fresh = plausiblePrices(
            details?.prices ?? [],
            point ?? SAO_PAULO,
          ).filter((row) => row.observedAt.getTime() >= since);
          if (fresh.length === 0) return null;
          const near = point
            ? fresh.filter((row) => distanceKm(point, row) <= NEAR_KM)
            : [];
          const sorted = (near.length > 0 ? near : fresh)
            .map((row) => row.price)
            .sort((a, b) => a - b);
          return {
            title: product.name,
            price:
              near.length > 0
                ? sorted[0]
                : sorted[Math.floor(sorted.length / 2)],
            store: 'PreçoMelhor',
            thumbnail: product.imageUrl,
            url: null,
            delivery: null,
            nearby: near.length > 0 ? 'Perto de você' : null,
            ean: product.ean,
          };
        }),
      )
    )
      .filter((offer): offer is WebOfferDto => offer !== null)
      // Sold near the person first: those are the ones the verdict can find.
      .sort(
        (a, b) =>
          Number(b.nearby !== null) - Number(a.nearby !== null) ||
          a.price - b.price,
      );
    if (offers.length === 0) return null;
    const place = point
      ? await this.placeOf(point.lat, point.lng, now.getTime())
      : { city: null };
    return {
      query,
      location: place.city,
      offers,
      searchedAt: now.toISOString(),
      source: 'PRECOMELHOR',
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
