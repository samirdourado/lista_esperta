import { Injectable } from '@nestjs/common';
import { normalizeText, sameSize, spaceSizes } from '../common/text.js';
import { Prisma } from '../generated/prisma/client.js';
import type { WebShoppingOffer } from '../integrations/serpapi/serpapi.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** A search answers again from the database for this long (D-076). */
export const WEB_CACHE_HOURS = 48;
/** Reference prices on the verdict come from searches this recent… */
export const WEB_REFERENCE_DAYS = 7;
/** …made within this many degrees (~30 km) of the shopper, or country-wide. */
const REGION_DEGREES = 0.3;
/** The item must appear in the offer title (pg_trgm word_similarity). */
const TITLE_WORD_SIMILARITY = 0.6;
/** And someone must have searched for about that item. */
const QUERY_SIMILARITY = 0.6;
const QUERY_WORD_SIMILARITY = 0.8;

export interface SavedSearch {
  searchedAt: Date;
  city: string | null;
  offers: WebShoppingOffer[];
}

export interface WebReference {
  price: number;
  store: string;
  title: string;
  seenAt: Date;
}

/** SQL side of normalizeText (no unaccent extension): "Sabão em Pó" → "sabao em po". */
const plain = (column: Prisma.Sql) =>
  Prisma.sql`translate(lower(${column}), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;

export const normalizeQuery = (value: string) =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

@Injectable()
export class WebPricesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The latest search for the same words and place, if still fresh. */
  async findFresh(
    query: string,
    place: string,
    now: Date,
  ): Promise<SavedSearch | null> {
    const search = await this.prisma.webSearch.findFirst({
      where: {
        query,
        place,
        searchedAt: {
          gt: new Date(now.getTime() - WEB_CACHE_HOURS * 3600_000),
        },
      },
      orderBy: { searchedAt: 'desc' },
      include: { offers: true },
    });
    if (!search) return null;
    return {
      searchedAt: search.searchedAt,
      city: search.city,
      offers: search.offers.map((offer) => ({
        position: offer.position,
        title: offer.title,
        price: offer.price.toNumber(),
        store: offer.store,
        thumbnail: offer.thumbnail,
        url: offer.url,
        delivery: offer.delivery,
        nearby: offer.nearby,
      })),
    };
  }

  /** Every result Google returned, not only the ones shown. */
  async save(input: {
    query: string;
    place: string;
    city: string | null;
    lat?: number;
    lng?: number;
    offers: WebShoppingOffer[];
    now: Date;
  }): Promise<void> {
    await this.prisma.webSearch.create({
      data: {
        query: input.query,
        place: input.place,
        city: input.city,
        // ~1 km is enough to find the region again; no exact position kept.
        lat: input.lat === undefined ? null : Number(input.lat.toFixed(2)),
        lng: input.lng === undefined ? null : Number(input.lng.toFixed(2)),
        searchedAt: input.now,
        offers: {
          create: input.offers.map((offer) => ({
            position: offer.position,
            title: offer.title,
            price: offer.price,
            store: offer.store,
            url: offer.url,
            thumbnail: offer.thumbnail,
            delivery: offer.delivery,
            nearby: offer.nearby,
          })),
        },
      },
    });
  }

  /**
   * Lowest recent price on the internet for a list item, around the shopper.
   * Conservative on purpose: someone searched about that item, its words are
   * in the offer title and a typed size matches, so "leite" never shows the
   * price of "doce de leite".
   */
  async cheapestFor(
    text: string,
    origin: { lat: number; lng: number },
    now: Date,
  ): Promise<WebReference | null> {
    const item = normalizeText(spaceSizes(text));
    if (item.length < 2) return null;
    const since = new Date(now.getTime() - WEB_REFERENCE_DAYS * 86_400_000);
    const rows = await this.prisma.$queryRaw<WebReference[]>`
      SELECT o.price::float8 AS price, o.store, o.title, s.searched_at AS "seenAt"
      FROM web_offers o
      JOIN web_searches s ON s.id = o.search_id
      WHERE s.searched_at > ${since}
        AND (s.lat IS NULL
             OR (abs(s.lat - ${origin.lat}) < ${REGION_DEGREES}
                 AND abs(s.lng - ${origin.lng}) < ${REGION_DEGREES}))
        AND (similarity(${plain(Prisma.sql`s.query`)}, ${item}) >= ${QUERY_SIMILARITY}
             OR word_similarity(${plain(Prisma.sql`s.query`)}, ${item}) >= ${QUERY_WORD_SIMILARITY})
        AND word_similarity(${item}, ${plain(Prisma.sql`o.title`)}) >= ${TITLE_WORD_SIMILARITY}
      ORDER BY o.price ASC, s.searched_at DESC
      LIMIT 20`;
    return rows.find((row) => sameSize(item, spaceSizes(row.title))) ?? null;
  }
}
