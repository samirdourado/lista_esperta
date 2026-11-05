import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  FLYER_SCRAPER,
  type FlyerScraper,
  type ScrapedPage,
} from '../integrations/firecrawl/firecrawl.service.js';
import {
  AiOutputError,
  FLYER_READER,
  type FlyerReader,
} from '../integrations/gemini/gemini.service.js';
import type { ExtractedFlyerDto } from '../integrations/gemini/gemini.dto.js';
import { ExternalServiceError } from '../integrations/http.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NormalizationService } from '../receipts/normalization.service.js';
import type { ReceiptLine } from '../receipts/receipt.types.js';
import type { FlyerImportDto, FlyerItemResultDto } from './flyers.dto.js';

/** A flyer that does not say until when its prices hold counts for a week. */
export const DEFAULT_FLYER_DAYS = 7;
/** Less text than this is a page without the flyer (login wall, image only…). */
const MIN_TEXT = 40;

export interface StoredFlyerItem extends FlyerItemResultDto {
  gtin: string | null;
  productId: string | null;
  aliasId: string | null;
}
interface StoredRaw {
  title: string | null;
  items: StoredFlyerItem[];
}

/** "2026-11-05" in São Paulo (UTC−3, no daylight saving). */
export function saoPauloDate(at: Date): string {
  return new Date(at.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Offers hold until the end of their last day, São Paulo time. */
export function flyerValidUntil(
  validUntil: string | null | undefined,
  now: Date,
): Date {
  if (validUntil) return new Date(`${validUntil}T23:59:59-03:00`);
  return new Date(now.getTime() + DEFAULT_FLYER_DAYS * 24 * 3600_000);
}

const unprocessable = (code: string, message: string) =>
  new UnprocessableEntityException({ code, message });

/**
 * Store flyers (spec section 5, source FLYER): Firecrawl reads the page or
 * PDF, Gemini lists products and prices, and the receipt normalization maps
 * them to the catalog. Only confident matches become prices; the rest waits
 * for an admin, like receipt lines.
 */
@Injectable()
export class FlyersService {
  private readonly logger = new Logger(FlyersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: NormalizationService,
    @Inject(FLYER_SCRAPER) private readonly scraper: FlyerScraper,
    @Inject(FLYER_READER) private readonly reader: FlyerReader,
  ) {}

  async import(
    storeId: string,
    url: string,
    userId: string,
    now = new Date(),
  ): Promise<FlyerImportDto> {
    if (!this.scraper.enabled || !this.reader.enabled) {
      throw new ServiceUnavailableException({
        code: 'FLYER_UNAVAILABLE',
        message: 'Flyer reading is not configured',
      });
    }
    // Failures are kept too: the merchant sees what was tried and why it failed.
    const fail = async (code: string, message: string) => {
      await this.prisma.flyerImport.create({
        data: {
          storeId,
          url,
          status: 'FAILED',
          error: code,
          raw: { title: null, items: [] },
          createdById: userId,
        },
      });
      return unprocessable(code, message);
    };

    let page: ScrapedPage;
    try {
      page = await this.scraper.scrape(url);
    } catch (error) {
      if (!(error instanceof ExternalServiceError)) throw error;
      this.logger.warn(`Flyer fetch failed: ${error.message}`);
      if (error.status === 402 || error.status === 429)
        throw new ServiceUnavailableException({
          code: 'FLYER_QUOTA',
          message: 'The flyer reader is out of quota; try again later',
        });
      throw await fail('FLYER_FETCH_FAILED', 'Could not open this link');
    }
    if (page.markdown.trim().length < MIN_TEXT)
      throw await fail('FLYER_EMPTY', 'No text found at this link');

    let extracted: ExtractedFlyerDto;
    try {
      extracted = await this.reader.readFlyer(page.markdown, saoPauloDate(now));
    } catch (error) {
      if (error instanceof ExternalServiceError)
        throw new ServiceUnavailableException({
          code: 'FLYER_SERVICE_UNAVAILABLE',
          message: 'Flyer reading did not answer',
        });
      if (error instanceof AiOutputError)
        throw await fail('FLYER_UNREADABLE', 'Could not read this flyer');
      throw error;
    }
    if (extracted.items.length === 0)
      throw await fail(
        'FLYER_NO_PRICES',
        'No product with a price in this flyer',
      );
    const validUntil = flyerValidUntil(extracted.valid_until, now);
    if (validUntil <= now)
      throw await fail('FLYER_EXPIRED', 'The offers in this flyer have ended');

    const lines: ReceiptLine[] = extracted.items.map((item) => ({
      description: item.description,
      code: item.gtin ?? null,
      quantity: 1,
      unit: 'UN',
      unitPrice: item.price,
      totalPrice: item.price,
    }));
    const matches = await this.normalization.match(lines, storeId);
    const items: StoredFlyerItem[] = extracted.items.map((item, index) => ({
      description: item.description,
      price: item.price,
      gtin: item.gtin ?? null,
      status: matches[index].status,
      productId: matches[index].productId,
      productName: matches[index].productName,
      aliasId: matches[index].aliasId,
    }));
    // One price per product per flyer: the first one listed.
    const priced = new Map<string, number>();
    for (const item of items)
      if (
        item.status === 'MATCHED' &&
        item.productId &&
        !priced.has(item.productId)
      )
        priced.set(item.productId, item.price);

    const saved = await this.prisma.$transaction(async (tx) => {
      const row = await tx.flyerImport.create({
        data: {
          storeId,
          url: page.url,
          status: 'DONE',
          validUntil,
          itemsFound: items.length,
          pricesAdded: priced.size,
          raw: {
            title: page.title,
            items,
          } as unknown as Prisma.InputJsonValue,
          createdById: userId,
        },
      });
      await tx.priceObservation.createMany({
        data: [...priced].map(([productId, price]) => ({
          productId,
          storeId,
          price,
          source: 'FLYER' as const,
          observedAt: now,
          validUntil,
          flyerId: row.id,
          reportedById: userId,
        })),
      });
      return row;
    });
    return toDto(saved);
  }

  async list(storeId: string): Promise<FlyerImportDto[]> {
    const rows = await this.prisma.flyerImport.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map(toDto);
  }
}

function toDto(row: {
  id: string;
  url: string;
  status: 'DONE' | 'FAILED';
  validUntil: Date | null;
  itemsFound: number;
  pricesAdded: number;
  error: string | null;
  raw: unknown;
  createdAt: Date;
}): FlyerImportDto {
  const raw = row.raw as StoredRaw;
  const items = raw.items ?? [];
  return {
    id: row.id,
    url: row.url,
    title: raw.title ?? null,
    status: row.status,
    validUntil: row.validUntil?.toISOString() ?? null,
    itemsFound: row.itemsFound,
    pricesAdded: row.pricesAdded,
    pending: items.filter((item) => item.status === 'PENDING').length,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    items: items.map((item) => ({
      description: item.description,
      price: item.price,
      status: item.status,
      productName: item.productName,
    })),
  };
}
