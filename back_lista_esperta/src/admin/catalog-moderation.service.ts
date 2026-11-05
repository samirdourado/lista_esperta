import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminOverviewDto,
  AdminProductDto,
  AliasDecisionDto,
  DuplicatePairDto,
  MergeResultDto,
  PendingAliasDto,
} from './catalog-moderation.dto.js';

/** Names at least this alike, same size and brand, are offered as duplicates. */
const DUPLICATE_SIMILARITY = 0.5;

type Tx = Prisma.TransactionClient;

interface RawLine {
  aliasId?: string | null;
  status?: string;
  productId?: string | null;
  productName?: string | null;
  unitPrice?: number;
  price?: number;
}

const notFound = (code: string, message: string) =>
  new NotFoundException({ code, message });

/**
 * Catalog moderation (spec section 6, Admin): aliases the model was unsure
 * about, and duplicate products. Approving an alias prices the receipts and
 * flyers that were waiting for it.
 */
@Injectable()
export class CatalogModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<AdminOverviewDto> {
    const [pendingClaims, pendingVerifications, pendingAliases] =
      await Promise.all([
        this.prisma.storeClaim.count({ where: { status: 'PENDING' } }),
        this.prisma.store.count({ where: { verificationStatus: 'PENDING' } }),
        this.prisma.productAlias.count({ where: { status: 'PENDING' } }),
      ]);
    return { pendingClaims, pendingVerifications, pendingAliases };
  }

  async pendingAliases(): Promise<PendingAliasDto[]> {
    const aliases = await this.prisma.productAlias.findMany({
      where: { status: 'PENDING' },
      include: { store: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    if (aliases.length === 0) return [];
    const ids = aliases.map((alias) => alias.id);
    const counts = await this.prisma.$queryRaw<
      { aliasId: string; n: number }[]
    >`
      SELECT "aliasId", sum(n)::int AS n FROM (
        SELECT l->>'aliasId' AS "aliasId", count(*) AS n
        FROM receipts r, jsonb_array_elements(r.raw->'lines') l
        WHERE l->>'aliasId' IN (${Prisma.join(ids)}) GROUP BY 1
        UNION ALL
        SELECT i->>'aliasId', count(*)
        FROM flyer_imports f, jsonb_array_elements(f.raw->'items') i
        WHERE i->>'aliasId' IN (${Prisma.join(ids)}) GROUP BY 1
      ) t GROUP BY "aliasId"`;
    const products = await this.products(aliases.map((a) => a.productId));
    return aliases.map((alias) => ({
      id: alias.id,
      rawText: alias.rawText,
      store: alias.store,
      product: products.get(alias.productId)!,
      occurrences: counts.find((c) => c.aliasId === alias.id)?.n ?? 0,
      createdAt: alias.createdAt.toISOString(),
    }));
  }

  async approveAlias(
    aliasId: string,
    productId?: string,
  ): Promise<AliasDecisionDto> {
    const alias = await this.pending(aliasId);
    const target = productId ?? alias.productId;
    const product = await this.prisma.product.findUnique({
      where: { id: target },
      select: { id: true, canonicalName: true },
    });
    if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Product not found');

    const pricesAdded = await this.prisma.$transaction(async (tx) => {
      await tx.productAlias.update({
        where: { id: aliasId },
        data: { status: 'APPROVED', productId: product.id },
      });
      const fromReceipts = await this.priceReceipts(tx, aliasId, product);
      const fromFlyers = await this.priceFlyers(tx, aliasId, product);
      return fromReceipts + fromFlyers;
    });
    return { id: aliasId, status: 'APPROVED', pricesAdded };
  }

  async rejectAlias(aliasId: string): Promise<AliasDecisionDto> {
    await this.pending(aliasId);
    await this.prisma.$transaction(async (tx) => {
      // Kept, not deleted: the same text must not be sent to the model again.
      await tx.productAlias.update({
        where: { id: aliasId },
        data: { status: 'REJECTED' },
      });
      await this.relabel(tx, 'receipts', 'lines', aliasId, {
        status: 'UNMATCHED',
        productId: null,
        productName: null,
      });
      await this.relabel(tx, 'flyer_imports', 'items', aliasId, {
        status: 'UNMATCHED',
        productId: null,
        productName: null,
      });
    });
    return { id: aliasId, status: 'REJECTED', pricesAdded: 0 };
  }

  async duplicates(): Promise<DuplicatePairDto[]> {
    const pairs = await this.prisma.$queryRaw<
      { a: string; b: string; score: number }[]
    >`
      SELECT a.id AS a, b.id AS b, similarity(a.canonical_name, b.canonical_name)::float8 AS score
      FROM products a
      JOIN products b ON a.id < b.id
        AND a.unit = b.unit AND a.unit_quantity = b.unit_quantity
        AND (a.brand IS NULL OR b.brand IS NULL OR lower(a.brand) = lower(b.brand))
        AND (a.gtin IS NULL OR b.gtin IS NULL OR a.gtin = b.gtin)
        AND a.canonical_name % b.canonical_name
      WHERE similarity(a.canonical_name, b.canonical_name) >= ${DUPLICATE_SIMILARITY}
      ORDER BY score DESC, a.canonical_name
      LIMIT 50`;
    const products = await this.products(pairs.flatMap((p) => [p.a, p.b]));
    return pairs.map((pair) => ({
      a: products.get(pair.a)!,
      b: products.get(pair.b)!,
      score: Math.round(pair.score * 100) / 100,
    }));
  }

  /**
   * Folds `mergeId` into `keepId`: prices, aliases, list items, alerts and
   * demand move over, then the duplicate is deleted. Different sizes or
   * brands are never merged (spec section 8).
   */
  async merge(keepId: string, mergeId: string): Promise<MergeResultDto> {
    if (keepId === mergeId)
      throw new BadRequestException({
        code: 'SAME_PRODUCT',
        message: 'Choose two different products',
      });
    const [keep, merge] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: keepId } }),
      this.prisma.product.findUnique({ where: { id: mergeId } }),
    ]);
    if (!keep || !merge)
      throw notFound('PRODUCT_NOT_FOUND', 'Product not found');
    if (
      keep.unit !== merge.unit ||
      !keep.unitQuantity.equals(merge.unitQuantity)
    )
      throw new ConflictException({
        code: 'SIZE_MISMATCH',
        message: 'Products of different sizes are different products',
      });
    if (
      keep.brand &&
      merge.brand &&
      keep.brand.toLowerCase() !== merge.brand.toLowerCase()
    )
      throw new ConflictException({
        code: 'BRAND_MISMATCH',
        message: 'Products of different brands are different products',
      });
    if (keep.gtin && merge.gtin && keep.gtin !== merge.gtin)
      throw new ConflictException({
        code: 'GTIN_MISMATCH',
        message: 'Products with different barcodes are different products',
      });

    const moved = await this.prisma.$transaction(async (tx) => {
      const prices = await tx.priceObservation.updateMany({
        where: { productId: mergeId },
        data: { productId: keepId },
      });
      const aliases = await tx.productAlias.updateMany({
        where: { productId: mergeId },
        data: { productId: keepId },
      });
      await tx.shoppingListItem.updateMany({
        where: { productId: mergeId },
        data: { productId: keepId },
      });
      // One alert per user and product: keep the one already on `keep`.
      await tx.$executeRaw`
        DELETE FROM price_alerts m USING price_alerts k
        WHERE m.product_id = ${mergeId}::uuid AND k.product_id = ${keepId}::uuid
          AND m.user_id = k.user_id`;
      await tx.priceAlert.updateMany({
        where: { productId: mergeId },
        data: { productId: keepId },
      });
      await tx.$executeRaw`
        INSERT INTO demand_signals (product_id, cell_key, day, lists)
        SELECT ${keepId}::uuid, cell_key, day, lists FROM demand_signals
        WHERE product_id = ${mergeId}::uuid
        ON CONFLICT (product_id, cell_key, day)
        DO UPDATE SET lists = demand_signals.lists + EXCLUDED.lists`;
      await tx.product.delete({ where: { id: mergeId } });
      await tx.product.update({
        where: { id: keepId },
        data: {
          gtin: keep.gtin ?? merge.gtin,
          brand: keep.brand ?? merge.brand,
        },
      });
      return { prices: prices.count, aliases: aliases.count };
    });
    const products = await this.products([keepId]);
    return {
      product: products.get(keepId)!,
      pricesMoved: moved.prices,
      aliasesMoved: moved.aliases,
    };
  }

  private async pending(aliasId: string) {
    const alias = await this.prisma.productAlias.findUnique({
      where: { id: aliasId },
    });
    if (!alias) throw notFound('ALIAS_NOT_FOUND', 'Alias not found');
    if (alias.status !== 'PENDING')
      throw new ConflictException({
        code: 'ALIAS_DECIDED',
        message: 'This alias was already reviewed',
      });
    return alias;
  }

  /** Receipt lines that waited for this alias become NFC-e prices. */
  private async priceReceipts(
    tx: Tx,
    aliasId: string,
    product: { id: string; canonicalName: string },
  ): Promise<number> {
    const receipts = await tx.$queryRaw<
      {
        id: string;
        storeId: string;
        issuedAt: Date;
        uploadedById: string | null;
        guestId: string | null;
        price: number;
      }[]
    >`
      SELECT DISTINCT ON (r.id) r.id, r.store_id AS "storeId", r.issued_at AS "issuedAt",
             r.uploaded_by_id AS "uploadedById", r.guest_id AS "guestId",
             (l->>'unitPrice')::float8 AS price
      FROM receipts r, jsonb_array_elements(r.raw->'lines') l
      WHERE l->>'aliasId' = ${aliasId} AND (l->>'unitPrice')::float8 > 0
        AND NOT EXISTS (SELECT 1 FROM price_observations po
                        WHERE po.receipt_id = r.id AND po.product_id = ${product.id}::uuid)
      ORDER BY r.id`;
    if (receipts.length > 0)
      await tx.priceObservation.createMany({
        data: receipts.map((receipt) => ({
          productId: product.id,
          storeId: receipt.storeId,
          price: receipt.price,
          source: 'NFCE' as const,
          observedAt: receipt.issuedAt,
          receiptId: receipt.id,
          reportedById: receipt.uploadedById,
          guestId: receipt.guestId,
        })),
      });
    await this.relabel(tx, 'receipts', 'lines', aliasId, {
      status: 'MATCHED',
      productId: product.id,
      productName: product.canonicalName,
    });
    return receipts.length;
  }

  /** Flyer items that waited for this alias become prices while the flyer holds. */
  private async priceFlyers(
    tx: Tx,
    aliasId: string,
    product: { id: string; canonicalName: string },
  ): Promise<number> {
    const flyers = await tx.$queryRaw<
      {
        id: string;
        storeId: string;
        createdAt: Date;
        validUntil: Date;
        createdById: string | null;
        price: number;
      }[]
    >`
      SELECT DISTINCT ON (f.id) f.id, f.store_id AS "storeId", f.created_at AS "createdAt",
             f.valid_until AS "validUntil", f.created_by_id AS "createdById",
             (i->>'price')::float8 AS price
      FROM flyer_imports f, jsonb_array_elements(f.raw->'items') i
      WHERE i->>'aliasId' = ${aliasId} AND f.status = 'DONE' AND f.valid_until > now()
        AND NOT EXISTS (SELECT 1 FROM price_observations po
                        WHERE po.flyer_id = f.id AND po.product_id = ${product.id}::uuid)
      ORDER BY f.id`;
    for (const flyer of flyers) {
      await tx.priceObservation.create({
        data: {
          productId: product.id,
          storeId: flyer.storeId,
          price: flyer.price,
          source: 'FLYER',
          observedAt: flyer.createdAt,
          validUntil: flyer.validUntil,
          flyerId: flyer.id,
          reportedById: flyer.createdById,
        },
      });
      await tx.flyerImport.update({
        where: { id: flyer.id },
        data: { pricesAdded: { increment: 1 } },
      });
    }
    await this.relabel(tx, 'flyer_imports', 'items', aliasId, {
      status: 'MATCHED',
      productId: product.id,
      productName: product.canonicalName,
    });
    return flyers.length;
  }

  /** Updates the lines kept in receipts.raw / flyer_imports.raw for this alias. */
  private async relabel(
    tx: Tx,
    table: 'receipts' | 'flyer_imports',
    key: 'lines' | 'items',
    aliasId: string,
    patch: Pick<RawLine, 'status' | 'productId' | 'productName'>,
  ): Promise<void> {
    const where = { raw: { path: [key], array_contains: [{ aliasId }] } };
    const rows =
      table === 'receipts'
        ? await tx.receipt.findMany({ where, select: { id: true, raw: true } })
        : await tx.flyerImport.findMany({
            where,
            select: { id: true, raw: true },
          });
    for (const row of rows) {
      const raw = row.raw as Record<string, unknown>;
      const lines = (raw[key] as RawLine[]).map((line) =>
        line.aliasId === aliasId ? { ...line, ...patch } : line,
      );
      const data = {
        raw: { ...raw, [key]: lines } as unknown as Prisma.InputJsonValue,
      };
      if (table === 'receipts')
        await tx.receipt.update({ where: { id: row.id }, data });
      else await tx.flyerImport.update({ where: { id: row.id }, data });
    }
  }

  private async products(ids: string[]): Promise<Map<string, AdminProductDto>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.product.findMany({
      where: { id: { in: unique } },
      include: { _count: { select: { prices: true } } },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          canonicalName: row.canonicalName,
          brand: row.brand,
          gtin: row.gtin,
          unit: row.unit,
          unitQuantity: Number(row.unitQuantity),
          prices: row._count.prices,
        },
      ]),
    );
  }
}
