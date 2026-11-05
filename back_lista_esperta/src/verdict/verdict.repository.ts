import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  FRESH_DAYS_FAST,
  FRESH_DAYS_MERCHANT,
} from '../prices/prices.repository.js';

export interface CurrentPriceRow {
  storeId: string;
  productId: string;
  price: number;
  source: 'NFCE' | 'MERCHANT' | 'FLYER' | 'COMMUNITY';
  observedAt: Date;
  offer: boolean;
  receiptCount: number;
}

/** Minimum trigram similarity to accept a typed item as a catalog product. */
const TEXT_MATCH_SIMILARITY = 0.3;

@Injectable()
export class VerdictRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The price shown for each product at each store (spec section 5):
   * the most recent trustworthy observation within its window. A running
   * merchant offer wins (it is the shelf price now); community prices are
   * used only when nothing better exists.
   */
  currentPrices(
    storeIds: string[],
    productIds: string[],
  ): Promise<CurrentPriceRow[]> {
    if (storeIds.length === 0 || productIds.length === 0)
      return Promise.resolve([]);
    const stores = Prisma.join(storeIds.map((id) => Prisma.sql`${id}::uuid`));
    const products = Prisma.join(
      productIds.map((id) => Prisma.sql`${id}::uuid`),
    );
    return this.prisma.$queryRaw<CurrentPriceRow[]>`
      SELECT DISTINCT ON (po.store_id, po.product_id)
             po.store_id AS "storeId", po.product_id AS "productId", po.price::float8 AS price,
             po.source::text AS source, po.observed_at AS "observedAt",
             (po.source = 'MERCHANT' AND po.valid_until IS NOT NULL) AS offer,
             (SELECT count(*) FROM price_observations n
               WHERE n.store_id = po.store_id AND n.product_id = po.product_id AND n.source = 'NFCE'
                 AND n.observed_at > now() - make_interval(days => ${FRESH_DAYS_FAST}))::int AS "receiptCount"
      FROM price_observations po
      WHERE po.store_id IN (${stores}) AND po.product_id IN (${products})
        AND po.retracted_at IS NULL
        AND (po.valid_until IS NULL OR po.valid_until > now())
        AND ((po.source IN ('MERCHANT', 'FLYER') AND po.observed_at > now() - make_interval(days => ${FRESH_DAYS_MERCHANT}))
             OR po.observed_at > now() - make_interval(days => ${FRESH_DAYS_FAST}))
      ORDER BY po.store_id, po.product_id,
               (po.source = 'COMMUNITY') ASC,
               (po.source = 'MERCHANT' AND po.valid_until IS NOT NULL) DESC,
               po.observed_at DESC`;
  }

  /** Free text → the closest catalog product (or a learned alias), if any. */
  async matchText(
    text: string,
  ): Promise<{ id: string; canonicalName: string } | null> {
    const alias = await this.prisma.productAlias.findFirst({
      where: {
        rawText: text.replace(/\s+/g, ' ').trim().toUpperCase(),
        status: 'APPROVED',
      },
      include: { product: { select: { id: true, canonicalName: true } } },
    });
    if (alias) return alias.product;
    const [row] = await this.prisma.$queryRaw<
      { id: string; canonicalName: string }[]
    >`
      SELECT id, canonical_name AS "canonicalName" FROM products
      WHERE similarity(canonical_name, ${text}) >= ${TEXT_MATCH_SIMILARITY}
         OR canonical_name ILIKE ${`%${text}%`}
      ORDER BY similarity(canonical_name, ${text}) DESC
      LIMIT 1`;
    return row ?? null;
  }

  /** Anonymous demand: +1 list per product in a ~1 km cell today (no ids stored). */
  async recordDemand(productIds: string[], cellKey: string): Promise<void> {
    if (productIds.length === 0) return;
    const rows = Prisma.join(
      productIds.map(
        (id) => Prisma.sql`(${id}::uuid, ${cellKey}, current_date, 1)`,
      ),
    );
    await this.prisma.$executeRaw`
      INSERT INTO demand_signals (product_id, cell_key, day, lists) VALUES ${rows}
      ON CONFLICT (product_id, cell_key, day) DO UPDATE SET lists = demand_signals.lists + 1`;
  }
}
