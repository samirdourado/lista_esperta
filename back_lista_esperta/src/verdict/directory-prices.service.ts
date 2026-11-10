import { Inject, Injectable, Logger } from '@nestjs/common';
import { distanceKm } from '../common/geo.js';
import {
  type DirectoryProductPrices,
  pickCandidates,
  plausiblePrices,
  PRICE_DIRECTORY,
  type PriceDirectory,
} from '../integrations/precomelhor/precomelhor.service.js';
import {
  GEOCODING_PROVIDER,
  type GeocodingProvider,
} from '../integrations/providers.js';
import { StoresGeoRepository } from '../stores/stores-geo.repository.js';

/** Older prices are not shown as if they were today's shelf (D-077). */
export const DIRECTORY_FRESH_DAYS = 30;
/** Brands tried for an item typed by hand ("arroz 5kg"). */
const TYPED_CANDIDATES = 5;
const CONCURRENCY = 6;
/** Region and spread used to compare the brands of one item. */
const ITEM_REGION_KM = 50;
const ITEM_FACTOR = 3;
/** Addresses looked up per verdict: the free geocoder does one per second. */
const MAX_ADDRESSES = 15;

export interface DirectoryPrice {
  itemIndex: number;
  storeId: string;
  price: number;
  observedAt: Date;
  productName: string;
  imageUrl: string | null;
}

export interface DirectoryItem {
  index: number;
  text: string;
  ean?: string;
}

/** What the browser read from the directory for one list item (D-079). */
export interface ProvidedItem {
  index: number;
  products: (DirectoryProductPrices & { nationalMedian?: number })[];
}

async function mapLimited<T, R>(
  values: T[],
  run: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(values.length);
  let next = 0;
  const worker = async () => {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await run(values[index]);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

/**
 * Prices of physical stores around the person for the items of a list.
 * Read when the verdict is asked for and not copied into our price history:
 * only the stores are kept, so they get an address and a place on the map.
 */
@Injectable()
export class DirectoryPricesService {
  private readonly logger = new Logger(DirectoryPricesService.name);
  private readonly filling = new Set<string>();

  constructor(
    @Inject(PRICE_DIRECTORY) private readonly directory: PriceDirectory,
    @Inject(GEOCODING_PROVIDER) private readonly geocoding: GeocodingProvider,
    private readonly geo: StoresGeoRepository,
  ) {}

  async forItems(
    items: DirectoryItem[],
    origin: { lat: number; lng: number },
    radiusKm: number,
    now: Date,
    provided?: ProvidedItem[],
  ): Promise<{ prices: DirectoryPrice[]; addressesPending: number }> {
    const byIndex = new Map(provided?.map((item) => [item.index, item]));
    if (!provided && !this.directory.enabled)
      return { prices: [], addressesPending: 0 };
    const since = now.getTime() - DIRECTORY_FRESH_DAYS * 86_400_000;
    const perItem = await mapLimited(items, async (item) => {
      // Sent by the browser (the directory blocks our server, D-079), or
      // fetched here when the server can reach it (local development).
      const products: (
        | (DirectoryProductPrices & {
            nationalMedian?: number;
          })
        | null
      )[] = provided
        ? (byIndex.get(item.index)?.products ?? [])
        : await this.fetchProducts(item);
      const eans = products.length;
      // Cheapest candidate per store.
      const byStore = new Map<
        string,
        Omit<DirectoryPrice, 'storeId'> & {
          external: { id: string; name: string; lat: number; lng: number };
        }
      >();
      // Across the brands of a typed item, a price far from the others in the
      // region is a data error (feijão 1 kg at R$ 239,99 when the rest is R$ 8).
      const regional = products
        .flatMap((product) => product?.prices ?? [])
        .filter(
          (row) =>
            row.observedAt.getTime() >= since &&
            distanceKm(origin, row) <= ITEM_REGION_KM,
        )
        .map((row) => row.price)
        .sort((a, b) => a - b);
      const itemMedian =
        eans > 1 && regional.length >= 4
          ? regional[Math.floor(regional.length / 2)]
          : null;
      for (const product of products) {
        if (!product) continue;
        for (const row of plausiblePrices(
          product.prices,
          origin,
          product.nationalMedian,
        )) {
          if (row.observedAt.getTime() < since) continue;
          if (distanceKm(origin, row) > radiusKm) continue;
          if (
            itemMedian !== null &&
            (row.price > itemMedian * ITEM_FACTOR ||
              row.price < itemMedian / ITEM_FACTOR)
          )
            continue;
          const held = byStore.get(row.storeId);
          if (held && held.price <= row.price) continue;
          byStore.set(row.storeId, {
            itemIndex: item.index,
            price: row.price,
            observedAt: row.observedAt,
            productName: product.name,
            imageUrl: product.imageUrl,
            external: {
              id: row.storeId,
              name: row.storeName,
              lat: row.lat,
              lng: row.lng,
            },
          });
        }
      }
      return [...byStore.values()];
    });

    const found = perItem.flat();
    const externals = new Map(
      found.map((row) => [row.external.id, row.external]),
    );
    const stores = await this.geo.ensureExternal('PRECOMELHOR', [
      ...externals.values(),
    ]);
    const missing = [...stores.values()]
      .filter((store) => !store.hasAddress)
      .sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b))
      .slice(0, MAX_ADDRESSES);
    void this.fillAddresses(missing);
    return {
      prices: found.map(({ external, ...row }) => ({
        ...row,
        storeId: stores.get(external.id)!.id,
      })),
      addressesPending: missing.length,
    };
  }

  private async fetchProducts(
    item: DirectoryItem,
  ): Promise<(DirectoryProductPrices | null)[]> {
    const eans = item.ean
      ? [item.ean]
      : pickCandidates(
          item.text,
          await this.directory.search(item.text),
          TYPED_CANDIDATES,
        ).map((product) => product.ean);
    return Promise.all(eans.map((ean) => this.directory.prices(ean)));
  }

  /** In the background, one at a time: the next poll of the verdict shows them. */
  private async fillAddresses(
    stores: { id: string; lat: number; lng: number }[],
  ): Promise<void> {
    for (const store of stores) {
      if (this.filling.has(store.id)) continue;
      this.filling.add(store.id);
      try {
        const place = await this.geocoding.reverse(store.lat, store.lng);
        // An empty address still marks the store as looked up.
        await this.geo.setAddress(store.id, place?.address ?? {});
      } catch (error) {
        this.logger.warn(
          `Store address: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        this.filling.delete(store.id);
      }
    }
  }
}
