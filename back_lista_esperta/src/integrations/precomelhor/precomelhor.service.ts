import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { distanceKm } from '../../common/geo.js';
import { normalizeText, sameSize, spaceSizes } from '../../common/text.js';
import type { Env } from '../../config/env.schema.js';
import { fetchJson } from '../http.js';

export interface DirectoryProduct {
  ean: string;
  name: string;
  imageUrl: string | null;
  storeCount: number;
}

export interface DirectoryStorePrice {
  storeId: string;
  storeName: string;
  lat: number;
  lng: number;
  price: number;
  observedAt: Date;
}

export interface DirectoryProductPrices {
  name: string;
  imageUrl: string | null;
  prices: DirectoryStorePrice[];
}

/** Prices by physical store and barcode. Today: PreçoMelhor (D-077). */
export interface PriceDirectory {
  readonly enabled: boolean;
  search(query: string): Promise<DirectoryProduct[]>;
  prices(ean: string): Promise<DirectoryProductPrices | null>;
}
export const PRICE_DIRECTORY = Symbol('PRICE_DIRECTORY');

interface SearchResponse {
  items?: {
    ean?: string;
    product_name?: string;
    image_url?: string | null;
    store_count?: number;
  }[];
}

interface ProductResponse {
  error?: string;
  product?: { product_name?: string; image_url?: string | null };
  prices?: {
    store_id?: number | string;
    store_name?: string;
    store_coords?: string;
    price?: number;
    promo_price?: number | null;
    update_date?: string;
  }[];
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
/** Their fair use is ~60 requests a minute per IP: stay below it. */
const MAX_CALLS_PER_MINUTE = 50;
const TIMEOUT_MS = 10_000;

/** Products a generic word must not turn into ("leite" is not "doce de leite"). */
const OTHER_PRODUCT = new Set(
  'condensado doce biscoito bolacha creme achocolatado sobremesa iogurte bebida pudim wafer chocolate bombom'.split(
    ' ',
  ),
);

/** "-23.5, -46.6" → numbers, or null when the text is not a real point. */
export function parseCoords(
  value: string | undefined,
): { lat: number; lng: number } | null {
  const [lat, lng] = (value ?? '').split(',').map((part) => Number(part));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0))
    return null;
  return { lat, lng };
}

/** Prices of the region decide what is plausible: the country mixes too much. */
const REGION_KM = 50;
const PLAUSIBLE_FACTOR = 2.5;

/**
 * Drops data errors (R$ 0,47 for a 500 g coffee): prices far from the median
 * of the same product in the region of the person (or the country, when the
 * region has fewer than 3 prices).
 */
export function plausiblePrices<
  T extends { price: number; lat: number; lng: number },
>(rows: T[], center: { lat: number; lng: number }): T[] {
  const regional = rows
    .filter((row) => distanceKm(center, row) <= REGION_KM)
    .map((row) => row.price)
    .sort((a, b) => a - b);
  // Few prices around: the country's median still catches the absurd ones.
  const basis =
    regional.length >= 3
      ? regional
      : rows.map((row) => row.price).sort((a, b) => a - b);
  if (basis.length < 3) return rows;
  const median = basis[Math.floor(basis.length / 2)];
  return rows.filter(
    (row) =>
      row.price >= median / PLAUSIBLE_FACTOR &&
      row.price <= median * PLAUSIBLE_FACTOR,
  );
}

/**
 * The products that really are what the person typed: every word in the
 * name, the same size, no different kind of product. Closest names first,
 * then the ones sold in more stores.
 */
export function pickCandidates(
  text: string,
  products: DirectoryProduct[],
  limit: number,
): DirectoryProduct[] {
  const typed = spaceSizes(text);
  const wanted = normalizeText(typed)
    .split(' ')
    .filter((word) => word.length > 1 && !/^\d/.test(word));
  if (wanted.length === 0) return [];
  const isMilk = wanted.includes('leite');
  return products
    .flatMap((product) => {
      const spaced = spaceSizes(product.name);
      const words = normalizeText(spaced).split(' ');
      const hasAll = wanted.every((word) =>
        words.some((candidate) => candidate.startsWith(word)),
      );
      const otherKind = words.some(
        (word) =>
          !wanted.includes(word) &&
          (OTHER_PRODUCT.has(word) || (isMilk && word === 'po')),
      );
      if (!hasAll || otherKind || !sameSize(typed, spaced)) return [];
      return [{ product, closeness: wanted.length / words.length }];
    })
    .sort(
      (a, b) =>
        Math.round(b.closeness * 10) - Math.round(a.closeness * 10) ||
        b.product.storeCount - a.product.storeCount,
    )
    .slice(0, limit)
    .map(({ product }) => product);
}

/**
 * https://www.precomelhor.com.br/desenvolvedores — free, no key, commercial
 * use allowed with visible attribution. Failures count as "no data": the
 * verdict still answers with the prices we hold.
 */
@Injectable()
export class PrecoMelhorService implements PriceDirectory {
  private readonly logger = new Logger(PrecoMelhorService.name);
  private readonly cache = new Map<string, { at: number; value: unknown }>();
  private calls: number[] = [];

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return this.config.get('PRECOMELHOR_ENABLED', { infer: true });
  }

  search(query: string): Promise<DirectoryProduct[]> {
    const q = encodeURIComponent(query.trim());
    return this.cached(`s:${query.trim().toLowerCase()}`, [], async () => {
      const body = await this.get<SearchResponse>(`/api/search?q=${q}`);
      return (body?.items ?? []).flatMap((item) =>
        item.ean && item.product_name
          ? [
              {
                ean: item.ean,
                name: item.product_name,
                imageUrl: item.image_url ?? null,
                storeCount: item.store_count ?? 0,
              },
            ]
          : [],
      );
    });
  }

  prices(ean: string): Promise<DirectoryProductPrices | null> {
    return this.cached(`p:${ean}`, null, async () => {
      const body = await this.get<ProductResponse>(`/api/product/${ean}`);
      if (!body?.product?.product_name) return null;
      return {
        name: body.product.product_name,
        imageUrl: body.product.image_url ?? null,
        prices: (body.prices ?? []).flatMap((row) => {
          const point = parseCoords(row.store_coords);
          const price = Number(row.promo_price ?? row.price);
          const observedAt = new Date(row.update_date ?? '');
          if (
            !point ||
            row.store_id === undefined ||
            !row.store_name ||
            !(price > 0) ||
            Number.isNaN(observedAt.getTime())
          )
            return [];
          return [
            {
              storeId: String(row.store_id),
              storeName: row.store_name,
              ...point,
              price,
              observedAt,
            },
          ];
        }),
      };
    });
  }

  /** A failed or skipped call answers `fallback` and is not remembered. */
  private async cached<T>(
    key: string,
    fallback: T,
    load: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && now - hit.at < CACHE_TTL_MS) return hit.value as T;
    try {
      const value = await load();
      if (this.cache.size >= CACHE_MAX)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { at: now, value });
      return value;
    } catch (error) {
      this.logger.warn(
        `PreçoMelhor: ${error instanceof Error ? error.message : String(error)}`,
      );
      return fallback;
    }
  }

  private async get<T>(path: string): Promise<T | null> {
    const now = Date.now();
    this.calls = this.calls.filter((at) => now - at < 60_000);
    if (this.calls.length >= MAX_CALLS_PER_MINUTE)
      throw new Error('local rate limit reached');
    this.calls.push(now);
    const base = this.config.get('PRECOMELHOR_URL', { infer: true });
    const { status, body } = await fetchJson<T>(
      'precomelhor',
      `${base}${path}`,
      {
        timeoutMs: TIMEOUT_MS,
        userAgent: this.config.get('HTTP_USER_AGENT', { infer: true }),
      },
    );
    if (status === 404) return null;
    if (!body) throw new Error(`HTTP ${status}`);
    return body;
  }
}
