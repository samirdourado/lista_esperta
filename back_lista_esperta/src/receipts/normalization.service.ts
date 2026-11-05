import { Inject, Injectable, Logger } from '@nestjs/common';
import { isValidGtin } from '../common/gtin.js';
import type { MeasureUnit } from '../generated/prisma/enums.js';
import {
  PRODUCT_NORMALIZER,
  type ProductNormalizer,
} from '../integrations/gemini/gemini.service.js';
import type { NormalizedProductDto } from '../integrations/gemini/gemini.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReceiptLine } from './receipt.types.js';

/** Below this, the alias waits for an admin and the price does not count (spec). */
export const MIN_CONFIDENCE = 0.8;
/** Below this the model did not understand the line: no product is created. */
export const MIN_CONFIDENCE_TO_KEEP = 0.5;
/** Similar enough to reuse an existing product with the same unit and size. */
const SAME_PRODUCT_SIMILARITY = 0.6;

export type LineStatus = 'MATCHED' | 'PENDING' | 'UNMATCHED';

export interface LineMatch {
  status: LineStatus;
  productId: string | null;
  productName: string | null;
  aliasId: string | null;
  /** How it was matched, for the audit trail in receipts.raw. */
  via: 'GTIN' | 'ALIAS' | 'AI' | null;
}

/** "lt  Leite Itambé int 1l" → "LT LEITE ITAMBÉ INT 1L": the alias key. */
export function aliasKey(description: string): string {
  return description.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 200);
}

/**
 * Turns receipt descriptions into catalog products:
 * 1. a valid barcode → product by GTIN;
 * 2. a known alias (this store's, then any store's);
 * 3. Gemini, with strict JSON validated by a DTO. Confidence < 0.8 keeps
 *    the alias PENDING: no price is recorded until an admin approves it.
 */
@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRODUCT_NORMALIZER) private readonly normalizer: ProductNormalizer,
  ) {}

  async match(lines: ReceiptLine[], storeId: string): Promise<LineMatch[]> {
    const results: (LineMatch | null)[] = lines.map(() => null);

    for (const [index, line] of lines.entries()) {
      if (line.code && isValidGtin(line.code)) {
        const product = await this.prisma.product.findUnique({
          where: { gtin: line.code },
        });
        if (product) {
          results[index] = {
            status: 'MATCHED',
            productId: product.id,
            productName: product.canonicalName,
            aliasId: null,
            via: 'GTIN',
          };
          continue;
        }
      }
      const alias = await this.prisma.productAlias.findFirst({
        where: {
          rawText: aliasKey(line.description),
          OR: [{ storeId }, { storeId: null }],
        },
        orderBy: { storeId: { sort: 'asc', nulls: 'last' } },
        include: { product: { select: { canonicalName: true } } },
      });
      if (alias?.status === 'REJECTED') {
        // An admin said this text is not that product: no price, no new guess.
        results[index] = {
          status: 'UNMATCHED',
          productId: null,
          productName: null,
          aliasId: alias.id,
          via: 'ALIAS',
        };
      } else if (alias) {
        results[index] = {
          status: alias.status === 'APPROVED' ? 'MATCHED' : 'PENDING',
          productId: alias.productId,
          productName: alias.product.canonicalName,
          aliasId: alias.id,
          via: 'ALIAS',
        };
      }
    }

    const missing = results.flatMap((result, index) => (result ? [] : [index]));
    if (missing.length > 0) {
      const normalized = await this.normalize(
        missing.map((index) => lines[index].description),
      );
      for (const item of normalized) {
        const index = missing[item.index];
        if (
          index === undefined ||
          results[index] ||
          item.confidence < MIN_CONFIDENCE_TO_KEEP
        )
          continue;
        results[index] = await this.adopt(lines[index], item, storeId);
      }
    }

    return results.map(
      (result) =>
        result ?? {
          status: 'UNMATCHED',
          productId: null,
          productName: null,
          aliasId: null,
          via: null,
        },
    );
  }

  private async normalize(
    descriptions: string[],
  ): Promise<NormalizedProductDto[]> {
    if (!this.normalizer.enabled) return [];
    const slugs = (
      await this.prisma.category.findMany({ select: { slug: true } })
    ).map((c) => c.slug);
    try {
      return await this.normalizer.normalize(descriptions, slugs);
    } catch (error) {
      // The receipt still counts for the lines we matched; the rest stays UNMATCHED.
      this.logger.warn(
        `Normalization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /** Finds or creates the product the model described, and remembers the alias. */
  private async adopt(
    line: ReceiptLine,
    item: NormalizedProductDto,
    storeId: string,
  ): Promise<LineMatch> {
    const unit = item.unit.toUpperCase() as MeasureUnit;
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { slug: item.category_slug },
    });
    const gtin = item.gtin && isValidGtin(item.gtin) ? item.gtin : null;

    let product = gtin
      ? await this.prisma.product.findUnique({ where: { gtin } })
      : null;
    if (!product) {
      // Never merge different units or sizes: only the same unit and quantity is "the same product".
      const [similar] = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM products
        WHERE unit = ${unit}::"MeasureUnit" AND unit_quantity = ${item.unit_quantity}
          AND similarity(canonical_name, ${item.canonical_name}) >= ${SAME_PRODUCT_SIMILARITY}
          -- Different brands are different products, even with the same name and size.
          AND (brand IS NULL OR ${item.brand ?? null}::text IS NULL OR lower(brand) = lower(${item.brand ?? null}))
        ORDER BY similarity(canonical_name, ${item.canonical_name}) DESC
        LIMIT 1`;
      product = similar
        ? await this.prisma.product.findUnique({ where: { id: similar.id } })
        : null;
    }
    product ??= await this.prisma.product.create({
      data: {
        gtin,
        canonicalName: item.canonical_name,
        brand: item.brand ?? null,
        categoryId: category.id,
        unit,
        unitQuantity: item.unit_quantity,
      },
    });

    const status = item.confidence >= MIN_CONFIDENCE ? 'APPROVED' : 'PENDING';
    const alias = await this.prisma.productAlias.upsert({
      where: {
        rawText_storeId: { rawText: aliasKey(line.description), storeId },
      },
      create: {
        rawText: aliasKey(line.description),
        storeId,
        productId: product.id,
        status,
      },
      update: {},
    });
    return {
      status: alias.status === 'APPROVED' ? 'MATCHED' : 'PENDING',
      productId: product.id,
      productName: product.canonicalName,
      aliasId: alias.id,
      via: 'AI',
    };
  }
}
