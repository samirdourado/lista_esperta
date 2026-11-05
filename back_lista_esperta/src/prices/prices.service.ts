import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseCsv, parseDay, parsePrice } from '../common/csv.js';
import { DEMAND_MIN_LISTS, demandCellsAround } from '../common/demand-cell.js';
import { isValidGtin, normalizeGtin } from '../common/gtin.js';
import { normalizeText } from '../common/text.js';
import type { MeasureUnit } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UNITS } from '../products/products.dto.js';
import { ProductsService } from '../products/products.service.js';
import { StoresGeoRepository } from '../stores/stores-geo.repository.js';
import {
  type CatalogItemDto,
  IMPORT_MAX_LOOKUPS,
  IMPORT_MAX_ROWS,
  type ImportReportDto,
  type ImportRowErrorDto,
  type PriceInputDto,
  type StoreOverviewDto,
} from './prices.dto.js';
import {
  DIVERGENCE_THRESHOLD,
  PricesRepository,
  type StoreCatalogRow,
} from './prices.repository.js';

const MAX_OFFER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Spreadsheet header (pt-BR or English), after normalizeText(), → field. */
const HEADERS: Record<string, keyof ImportColumns> = {
  gtin: 'gtin',
  ean: 'gtin',
  codigo: 'gtin',
  'codigo de barras': 'gtin',
  barcode: 'gtin',
  nome: 'name',
  produto: 'name',
  name: 'name',
  descricao: 'name',
  preco: 'price',
  price: 'price',
  valor: 'price',
  'oferta ate': 'validUntil',
  'valido ate': 'validUntil',
  'valid until': 'validUntil',
  validuntil: 'validUntil',
  categoria: 'category',
  category: 'category',
  unidade: 'unit',
  unit: 'unit',
  quantidade: 'quantity',
  'unit quantity': 'quantity',
  quantity: 'quantity',
  marca: 'brand',
  brand: 'brand',
};

interface ImportColumns {
  gtin?: number;
  name?: number;
  price?: number;
  validUntil?: number;
  category?: number;
  unit?: number;
  quantity?: number;
  brand?: number;
}

function toItem(row: StoreCatalogRow): CatalogItemDto {
  const divergent =
    row.receiptPrice !== null &&
    row.regularPrice !== null &&
    Math.abs(row.receiptPrice - row.regularPrice) / row.regularPrice >
      DIVERGENCE_THRESHOLD;
  return {
    ...row,
    regularObservedAt: row.regularObservedAt?.toISOString() ?? null,
    offerValidUntil: row.offerValidUntil?.toISOString() ?? null,
    receiptAt: row.receiptAt?.toISOString() ?? null,
    divergent,
  };
}

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PricesRepository,
    private readonly geo: StoresGeoRepository,
    private readonly products: ProductsService,
  ) {}

  async catalog(storeId: string, q?: string): Promise<CatalogItemDto[]> {
    return (await this.repo.catalog(storeId, q)).map(toItem);
  }

  /**
   * Bulk edit. Each entry is a new dated observation (the latest wins), so the
   * price history is kept. With `validUntil` it is an offer.
   */
  async setPrices(
    storeId: string,
    userId: string,
    prices: PriceInputDto[],
  ): Promise<number> {
    const now = Date.now();
    for (const entry of prices) {
      if (
        entry.validUntil &&
        (entry.validUntil.getTime() <= now ||
          entry.validUntil.getTime() > now + MAX_OFFER_DAYS * DAY_MS)
      ) {
        throw new BadRequestException({
          code: 'INVALID_OFFER_END',
          message: 'Offers must end within the next 90 days',
        });
      }
    }
    const ids = [...new Set(prices.map((entry) => entry.productId))];
    const found = await this.prisma.product.count({
      where: { id: { in: ids } },
    });
    if (found !== ids.length)
      throw new BadRequestException({
        code: 'UNKNOWN_PRODUCT',
        message: 'Unknown product',
      });

    const { count } = await this.prisma.priceObservation.createMany({
      data: prices.map((entry) => ({
        productId: entry.productId,
        storeId,
        price: entry.price,
        source: 'MERCHANT' as const,
        validUntil: entry.validUntil ?? null,
        reportedById: userId,
      })),
    });
    return count;
  }

  /** "Não vendo mais": withdraws every active merchant price of the product here. */
  async withdrawProduct(storeId: string, productId: string): Promise<void> {
    const { count } = await this.prisma.priceObservation.updateMany({
      where: { storeId, productId, source: 'MERCHANT', retractedAt: null },
      data: { retractedAt: new Date() },
    });
    if (count === 0)
      throw new NotFoundException('The store does not sell this product');
  }

  async endOffer(storeId: string, offerId: string): Promise<void> {
    if (!/^\d+$/.test(offerId)) throw new NotFoundException('Offer not found');
    const { count } = await this.prisma.priceObservation.updateMany({
      where: {
        id: BigInt(offerId),
        storeId,
        source: 'MERCHANT',
        retractedAt: null,
        validUntil: { gt: new Date() },
      },
      data: { retractedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Offer not found');
  }

  /**
   * Spreadsheet import. Rows are matched by barcode (catalog, then Open Food
   * Facts) or by exact name; with category, unit and quantity columns a
   * missing product is created. Bad rows are reported, good rows are saved.
   */
  async importCsv(
    storeId: string,
    userId: string,
    text: string,
  ): Promise<ImportReportDto> {
    const rows = parseCsv(text);
    if (rows.length < 2)
      throw new BadRequestException({
        code: 'EMPTY_FILE',
        message: 'The file has no rows',
      });
    if (rows.length - 1 > IMPORT_MAX_ROWS) {
      throw new BadRequestException({
        code: 'TOO_MANY_ROWS',
        message: `Up to ${IMPORT_MAX_ROWS} rows per file`,
      });
    }
    const columns: ImportColumns = {};
    rows[0].forEach((header, index) => {
      const key = HEADERS[normalizeText(header)];
      if (key && columns[key] === undefined) columns[key] = index;
    });
    if (
      columns.price === undefined ||
      (columns.gtin === undefined && columns.name === undefined)
    ) {
      throw new BadRequestException({
        code: 'MISSING_COLUMNS',
        message: 'The file needs a price column and a barcode or name column',
      });
    }

    const categories = new Map(
      (
        await this.prisma.category.findMany({
          select: { id: true, slug: true },
        })
      ).map((c) => [c.slug, c.id]),
    );
    const errors: ImportRowErrorDto[] = [];
    const prices: PriceInputDto[] = [];
    let productsCreated = 0;
    let lookups = 0;
    const cell = (row: string[], key: keyof ImportColumns) =>
      columns[key] === undefined ? '' : (row[columns[key]] ?? '').trim();

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const line = i + 1;
      const price = parsePrice(cell(row, 'price'));
      if (price === null) {
        errors.push({ line, code: 'MISSING_PRICE' });
        continue;
      }
      const rawDate = cell(row, 'validUntil');
      const validUntil = rawDate ? parseDay(rawDate) : null;
      if (
        rawDate &&
        (!validUntil ||
          validUntil.getTime() <= Date.now() ||
          validUntil.getTime() > Date.now() + MAX_OFFER_DAYS * DAY_MS)
      ) {
        errors.push({ line, code: 'INVALID_DATE' });
        continue;
      }

      const gtin = normalizeGtin(cell(row, 'gtin'));
      const name = cell(row, 'name');
      let productId: string | undefined;

      if (gtin) {
        if (!isValidGtin(gtin)) {
          errors.push({ line, code: 'INVALID_GTIN' });
          continue;
        }
        productId = (
          await this.prisma.product.findUnique({
            where: { gtin },
            select: { id: true },
          })
        )?.id;
      }
      if (!productId && name) {
        productId = (
          await this.prisma.product.findFirst({
            where: { canonicalName: { equals: name, mode: 'insensitive' } },
            select: { id: true },
          })
        )?.id;
      }
      if (!productId) {
        // Create it from the spreadsheet columns, or from Open Food Facts by barcode.
        let draft: {
          name: string;
          brand: string | null;
          categoryId?: string;
          unit: MeasureUnit | null;
          quantity: number | null;
        } | null = null;
        const unitCell = cell(row, 'unit').toUpperCase();
        if (name && cell(row, 'category')) {
          const categoryId = categories.get(
            normalizeText(cell(row, 'category')).replace(/ /g, '-'),
          );
          if (!categoryId) {
            errors.push({ line, code: 'UNKNOWN_CATEGORY' });
            continue;
          }
          const unit = (UNITS as readonly string[]).includes(unitCell)
            ? (unitCell as MeasureUnit)
            : null;
          const quantity = Number(cell(row, 'quantity').replace(',', '.'));
          if (!unit || !(quantity > 0)) {
            errors.push({ line, code: 'INVALID_UNIT' });
            continue;
          }
          draft = {
            name,
            brand: cell(row, 'brand') || null,
            categoryId,
            unit,
            quantity,
          };
        } else if (gtin) {
          if (lookups >= IMPORT_MAX_LOOKUPS) {
            errors.push({ line, code: 'LOOKUP_LIMIT' });
            continue;
          }
          lookups += 1;
          const suggestion = await this.products.suggest(gtin);
          const categoryId = suggestion?.categorySlug
            ? categories.get(suggestion.categorySlug)
            : undefined;
          if (
            suggestion &&
            categoryId &&
            suggestion.unit &&
            suggestion.unitQuantity
          ) {
            draft = {
              name: suggestion.name,
              brand: suggestion.brand,
              categoryId,
              unit: suggestion.unit,
              quantity: suggestion.unitQuantity,
            };
          }
        }
        if (!draft?.categoryId || !draft.unit || !draft.quantity) {
          errors.push({ line, code: 'PRODUCT_NOT_FOUND' });
          continue;
        }
        const created = await this.prisma.product.create({
          data: {
            gtin: gtin || null,
            canonicalName: draft.name,
            brand: draft.brand,
            categoryId: draft.categoryId,
            unit: draft.unit,
            unitQuantity: draft.quantity,
          },
          select: { id: true },
        });
        productId = created.id;
        productsCreated += 1;
      }
      prices.push({ productId, price, ...(validUntil ? { validUntil } : {}) });
    }

    const pricesSaved =
      prices.length > 0 ? await this.setPrices(storeId, userId, prices) : 0;
    return { rowsRead: rows.length - 1, pricesSaved, productsCreated, errors };
  }

  async overview(storeId: string): Promise<StoreOverviewDto> {
    const store = await this.geo.findById(storeId);
    if (!store) throw new NotFoundException('Store not found');
    const items = await this.catalog(storeId);
    const listed = new Set(items.map((item) => item.productId));
    const compare = items.filter(
      (item) =>
        item.regularPrice !== null &&
        item.regionMedian !== null &&
        item.regionStores > 0,
    );
    const demand = await this.repo.demand(
      storeId,
      demandCellsAround(store.lat, store.lng),
      DEMAND_MIN_LISTS,
    );

    return {
      productsListed: items.length,
      activeOffers: items.filter((item) => item.offerId).length,
      belowMedian: compare.filter(
        (item) => item.regularPrice! < item.regionMedian!,
      ).length,
      aboveMedian: compare.filter(
        (item) => item.regularPrice! > item.regionMedian!,
      ).length,
      divergences: items
        .filter((item) => item.divergent)
        .map((item) => ({
          productId: item.productId,
          canonicalName: item.canonicalName,
          merchantPrice: item.regularPrice!,
          receiptPrice: item.receiptPrice!,
          receiptAt: item.receiptAt!,
          difference:
            Math.round(
              ((item.receiptPrice! - item.regularPrice!) / item.regularPrice!) *
                1000,
            ) / 1000,
        })),
      demand: demand.map((row) => ({
        ...row,
        listed: listed.has(row.productId),
      })),
    };
  }
}
