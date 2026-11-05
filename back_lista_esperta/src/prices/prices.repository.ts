import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { MeasureUnit } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Window for "current" prices: receipts and community age fast, shop prices slower. */
export const FRESH_DAYS_FAST = 7;
export const FRESH_DAYS_MERCHANT = 30;
export const REGION_RADIUS_M = 5000;
/** A receipt more than 15 % away from the merchant price is flagged. */
export const DIVERGENCE_THRESHOLD = 0.15;

export interface StoreCatalogRow {
  productId: string;
  gtin: string | null;
  canonicalName: string;
  brand: string | null;
  categorySlug: string;
  unit: MeasureUnit;
  unitQuantity: number;
  regularPrice: number | null;
  regularObservedAt: Date | null;
  offerId: string | null;
  offerPrice: number | null;
  offerValidUntil: Date | null;
  regionMedian: number | null;
  regionStores: number;
  receiptPrice: number | null;
  receiptAt: Date | null;
}

/** Latest price per other store nearby, used for the regional median. */
const freshness = Prisma.sql`(
  (po.source IN ('MERCHANT', 'FLYER') AND po.observed_at > now() - make_interval(days => ${FRESH_DAYS_MERCHANT}))
  OR po.observed_at > now() - make_interval(days => ${FRESH_DAYS_FAST})
)`;

@Injectable()
export class PricesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Products the store sells (an active merchant price), each with its
   * regular price, running offer, the median of other stores within 5 km and
   * the latest NFC-e price paid at this store.
   */
  catalog(storeId: string, search?: string): Promise<StoreCatalogRow[]> {
    const filter = search
      ? Prisma.sql`AND (p.canonical_name ILIKE ${`%${search}%`} OR p.gtin = ${search})`
      : Prisma.empty;
    return this.prisma.$queryRaw<StoreCatalogRow[]>`
      WITH here AS (SELECT location FROM stores WHERE id = ${storeId}::uuid),
      listed AS (
        SELECT DISTINCT po.product_id FROM price_observations po
        WHERE po.store_id = ${storeId}::uuid AND po.source = 'MERCHANT' AND po.retracted_at IS NULL
          AND (po.valid_until IS NULL OR po.valid_until > now())
      )
      SELECT p.id AS "productId", p.gtin, p.canonical_name AS "canonicalName", p.brand,
             c.slug AS "categorySlug", p.unit::text AS unit, p.unit_quantity::float8 AS "unitQuantity",
             reg.price::float8 AS "regularPrice", reg.observed_at AS "regularObservedAt",
             offer.id::text AS "offerId", offer.price::float8 AS "offerPrice", offer.valid_until AS "offerValidUntil",
             region.median::float8 AS "regionMedian", COALESCE(region.stores, 0)::int AS "regionStores",
             nf.price::float8 AS "receiptPrice", nf.observed_at AS "receiptAt"
      FROM listed l
      JOIN products p ON p.id = l.product_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT price, observed_at FROM price_observations
        WHERE product_id = p.id AND store_id = ${storeId}::uuid AND source = 'MERCHANT'
          AND retracted_at IS NULL AND valid_until IS NULL
        ORDER BY observed_at DESC LIMIT 1
      ) reg ON true
      LEFT JOIN LATERAL (
        SELECT id, price, valid_until FROM price_observations
        WHERE product_id = p.id AND store_id = ${storeId}::uuid AND source = 'MERCHANT'
          AND retracted_at IS NULL AND valid_until > now()
        ORDER BY observed_at DESC LIMIT 1
      ) offer ON true
      LEFT JOIN LATERAL (
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY latest.price) AS median, count(*) AS stores
        FROM (
          SELECT DISTINCT ON (po.store_id) po.price
          FROM price_observations po JOIN stores s ON s.id = po.store_id, here
          WHERE po.product_id = p.id AND po.store_id <> ${storeId}::uuid AND po.retracted_at IS NULL
            AND (po.valid_until IS NULL OR po.valid_until > now()) AND ${freshness}
            AND ST_DWithin(s.location, here.location, ${REGION_RADIUS_M})
          ORDER BY po.store_id, po.observed_at DESC
        ) latest
      ) region ON true
      LEFT JOIN LATERAL (
        SELECT price, observed_at FROM price_observations
        WHERE product_id = p.id AND store_id = ${storeId}::uuid AND source = 'NFCE'
          AND observed_at > now() - make_interval(days => ${FRESH_DAYS_FAST})
        ORDER BY observed_at DESC LIMIT 1
      ) nf ON true
      WHERE true ${filter}
      ORDER BY p.canonical_name`;
  }

  /**
   * How many lists asked for each product in the store's area over 7 days,
   * only where at least `minLists` lists contributed (k-anonymity).
   */
  demand(storeId: string, cellKeys: string[], minLists: number) {
    return this.prisma.$queryRaw<
      { productId: string; canonicalName: string; lists: number }[]
    >`
      SELECT d.product_id AS "productId", p.canonical_name AS "canonicalName", sum(d.lists)::int AS lists
      FROM demand_signals d JOIN products p ON p.id = d.product_id
      WHERE d.cell_key IN (${Prisma.join(cellKeys)}) AND d.day > current_date - 7
      GROUP BY d.product_id, p.canonical_name
      HAVING sum(d.lists) >= ${minLists}
      ORDER BY lists DESC
      LIMIT 20`;
  }
}
