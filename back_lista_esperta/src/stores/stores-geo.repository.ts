import { Injectable } from '@nestjs/common';
import type {
  StoreSource,
  VerificationStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface NewStore {
  name: string;
  source: StoreSource;
  lat: number;
  lng: number;
  cnpj?: string | null;
  googlePlaceId?: string | null;
  verificationStatus?: VerificationStatus;
  address?: unknown;
  openingHours?: unknown;
}

export interface NearbyStoreRow {
  id: string;
  name: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

/**
 * The only place that reads or writes `stores.location` (geography).
 * Always tagged templates: Prisma turns each ${value} into a bind parameter.
 */
@Injectable()
export class StoresGeoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(store: NewStore): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO stores (id, name, cnpj, google_place_id, source, verification_status, location, address, opening_hours)
      VALUES (
        gen_random_uuid(),
        ${store.name},
        ${store.cnpj ?? null},
        ${store.googlePlaceId ?? null},
        ${store.source}::"StoreSource",
        ${store.verificationStatus ?? 'UNVERIFIED'}::"VerificationStatus",
        ST_SetSRID(ST_MakePoint(${store.lng}, ${store.lat}), 4326)::geography,
        ${store.address === undefined ? null : JSON.stringify(store.address)}::jsonb,
        ${store.openingHours === undefined ? null : JSON.stringify(store.openingHours)}::jsonb
      )
      RETURNING id`;
    return rows[0].id;
  }

  findNearby(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<NearbyStoreRow[]> {
    return this.prisma.$queryRaw<NearbyStoreRow[]>`
      SELECT s.id, s.name,
             ST_Distance(s.location, ST_MakePoint(${lng}, ${lat})::geography) / 1000 AS "distanceKm",
             ST_Y(s.location::geometry) AS lat,
             ST_X(s.location::geometry) AS lng
      FROM stores s
      WHERE ST_DWithin(s.location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusKm} * 1000)
      ORDER BY "distanceKm"`;
  }
}
