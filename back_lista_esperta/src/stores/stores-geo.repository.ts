import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type {
  StoreSource,
  VerificationStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  OpeningHours,
  PlaceCandidate,
  StoreAddress,
} from './store.types.js';

export interface NewStore {
  name: string;
  source: StoreSource;
  lat: number;
  lng: number;
  cnpj?: string | null;
  externalId?: string | null;
  verificationStatus?: VerificationStatus;
  address?: StoreAddress;
  openingHours?: OpeningHours;
}

/** A store as read from the database, with its position as numbers. */
export interface StoreRow {
  id: string;
  name: string;
  cnpj: string | null;
  source: StoreSource;
  verificationStatus: VerificationStatus;
  lat: number;
  lng: number;
  address: StoreAddress | null;
  openingHours: OpeningHours | null;
  categories: string[];
  /** Has at least one StoreMember (a merchant runs it on the app). */
  managed: boolean;
  distanceKm?: number;
}

/** Runs the query on the default client or inside a transaction. */
type SqlClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

/** Duplicate rule from the spec: same CNPJ, or < 50 m away with a similar name. */
export const DUPLICATE_RADIUS_M = 50;
export const DUPLICATE_NAME_SIMILARITY = 0.4;

const json = (value: unknown) =>
  value === undefined || value === null ? null : JSON.stringify(value);

const point = (lat: number, lng: number) =>
  Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

/** Columns every read returns (see StoreRow). */
const STORE_COLUMNS = Prisma.sql`
  s.id, s.name, s.cnpj, s.source::text AS source,
  s.verification_status::text AS "verificationStatus",
  ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng,
  s.address, s.opening_hours AS "openingHours",
  COALESCE((SELECT array_agg(c.slug ORDER BY c.slug) FROM store_categories sc
            JOIN categories c ON c.id = sc.category_id WHERE sc.store_id = s.id), '{}') AS categories,
  EXISTS (SELECT 1 FROM store_members m WHERE m.store_id = s.id) AS managed`;

/**
 * The only place that reads or writes `stores.location` (geography).
 * Always tagged templates / Prisma.sql: every ${value} becomes a bind parameter.
 */
@Injectable()
export class StoresGeoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(store: NewStore, db: SqlClient = this.prisma): Promise<string> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      INSERT INTO stores (id, name, cnpj, external_id, source, verification_status, location, address, opening_hours)
      VALUES (
        gen_random_uuid(), ${store.name}, ${store.cnpj ?? null}, ${store.externalId ?? null},
        ${store.source}::"StoreSource",
        ${store.verificationStatus ?? 'UNVERIFIED'}::"VerificationStatus",
        ${point(store.lat, store.lng)},
        ${json(store.address)}::jsonb, ${json(store.openingHours)}::jsonb
      )
      RETURNING id`;
    return rows[0].id;
  }

  /**
   * Stores of an outside directory, created on first sight (no duplicates:
   * unique source + external id). Returns them by external id.
   */
  async ensureExternal(
    source: 'PRECOMELHOR',
    stores: { id: string; name: string; lat: number; lng: number }[],
  ): Promise<
    Map<string, { id: string; lat: number; lng: number; hasAddress: boolean }>
  > {
    const result = new Map<
      string,
      { id: string; lat: number; lng: number; hasAddress: boolean }
    >();
    if (stores.length === 0) return result;
    for (const store of stores) {
      await this.prisma.$executeRaw`
        INSERT INTO stores (id, name, external_id, source, verification_status, location, updated_at)
        VALUES (gen_random_uuid(), ${store.name}, ${store.id}, ${source}::"StoreSource",
                'UNVERIFIED'::"VerificationStatus", ${point(store.lat, store.lng)}, now())
        ON CONFLICT (source, external_id) DO NOTHING`;
    }
    const ids = Prisma.join(stores.map((store) => store.id));
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        externalId: string;
        lat: number;
        lng: number;
        hasAddress: boolean;
      }[]
    >`
      SELECT s.id, s.external_id AS "externalId", ST_Y(s.location::geometry) AS lat,
             ST_X(s.location::geometry) AS lng, s.address IS NOT NULL AS "hasAddress"
      FROM stores s
      WHERE s.source = ${source}::"StoreSource" AND s.external_id IN (${ids})`;
    for (const { externalId, ...row } of rows) result.set(externalId, row);
    return result;
  }

  async setAddress(id: string, address: StoreAddress): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE stores SET address = ${json(address)}::jsonb, updated_at = now() WHERE id = ${id}::uuid`;
  }

  async updateLocation(
    id: string,
    lat: number,
    lng: number,
    db: SqlClient = this.prisma,
  ): Promise<void> {
    await db.$executeRaw`
      UPDATE stores SET location = ${point(lat, lng)}, updated_at = now() WHERE id = ${id}::uuid`;
  }

  async findById(id: string): Promise<StoreRow | null> {
    const rows = await this.prisma.$queryRaw<StoreRow[]>`
      SELECT ${STORE_COLUMNS} FROM stores s WHERE s.id = ${id}::uuid`;
    return rows[0] ?? null;
  }

  findManyByIds(ids: string[]): Promise<StoreRow[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.$queryRaw<StoreRow[]>`
      SELECT ${STORE_COLUMNS} FROM stores s
      WHERE s.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY s.name`;
  }

  findNearby(
    lat: number,
    lng: number,
    radiusKm: number,
    limit = 200,
  ): Promise<StoreRow[]> {
    return this.prisma.$queryRaw<StoreRow[]>`
      SELECT ${STORE_COLUMNS},
             ST_Distance(s.location, ${point(lat, lng)}) / 1000 AS "distanceKm"
      FROM stores s
      WHERE ST_DWithin(s.location, ${point(lat, lng)}, ${radiusKm * 1000})
      ORDER BY "distanceKm"
      LIMIT ${limit}`;
  }

  /**
   * Stores a merchant may want to claim: close to the given point, best name
   * matches first. Without a name, the closest ones.
   */
  findClaimable(
    lat: number,
    lng: number,
    name: string | undefined,
    radiusKm = 1,
  ): Promise<StoreRow[]> {
    // Names that really look alike first (pg_trgm default threshold), then the closest.
    const order = name
      ? Prisma.sql`(similarity(s.name, ${name}) >= 0.3) DESC, "distanceKm"`
      : Prisma.sql`"distanceKm"`;
    return this.prisma.$queryRaw<StoreRow[]>`
      SELECT ${STORE_COLUMNS},
             ST_Distance(s.location, ${point(lat, lng)}) / 1000 AS "distanceKm"
      FROM stores s
      WHERE ST_DWithin(s.location, ${point(lat, lng)}, ${radiusKm * 1000})
      ORDER BY ${order}
      LIMIT 20`;
  }

  /** Same store already on the map? (CNPJ, or < 50 m with a similar name.) */
  async findDuplicate(candidate: {
    name: string;
    lat: number;
    lng: number;
    cnpj?: string | null;
    excludeSource?: StoreSource;
  }): Promise<{ id: string; name: string } | null> {
    const notSource = candidate.excludeSource
      ? Prisma.sql`AND s.source <> ${candidate.excludeSource}::"StoreSource"`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT s.id, s.name FROM stores s
      WHERE (
        (${candidate.cnpj ?? null}::text IS NOT NULL AND s.cnpj = ${candidate.cnpj ?? null})
        OR (
          ST_DWithin(s.location, ${point(candidate.lat, candidate.lng)}, ${DUPLICATE_RADIUS_M})
          AND similarity(s.name, ${candidate.name}) >= ${DUPLICATE_NAME_SIMILARITY}
        )
      ) ${notSource}
      ORDER BY similarity(s.name, ${candidate.name}) DESC
      LIMIT 1`;
    return rows[0] ?? null;
  }

  /**
   * Imports one shop from a places provider.
   * - Skips it when a store from another source is the same place.
   * - Refreshes it on later imports, unless a merchant now runs it: their
   *   data wins over the map's.
   */
  async upsertDiscoveredPlace(
    source: StoreSource,
    place: PlaceCandidate,
  ): Promise<{ id: string; created: boolean } | null> {
    const duplicate = await this.findDuplicate({
      ...place,
      excludeSource: source,
    });
    if (duplicate) return null;
    const rows = await this.prisma.$queryRaw<
      { id: string; created: boolean }[]
    >`
      INSERT INTO stores (id, name, source, external_id, verification_status, location, address, opening_hours)
      VALUES (
        gen_random_uuid(), ${place.name}, ${source}::"StoreSource", ${place.externalId},
        'UNVERIFIED'::"VerificationStatus", ${point(place.lat, place.lng)},
        ${json(place.address)}::jsonb, ${json(place.openingHours)}::jsonb
      )
      ON CONFLICT (source, external_id) DO UPDATE SET
        name = EXCLUDED.name, location = EXCLUDED.location, address = EXCLUDED.address,
        opening_hours = EXCLUDED.opening_hours, updated_at = now()
      WHERE NOT EXISTS (SELECT 1 FROM store_members m WHERE m.store_id = stores.id)
      RETURNING id, (xmax = 0) AS created`;
    return rows[0] ?? null;
  }
}
