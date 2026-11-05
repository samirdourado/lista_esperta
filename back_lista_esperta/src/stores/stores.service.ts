import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DiscoveryService } from './discovery.service.js';
import { type OpeningHours, WEEK_DAYS } from './store.types.js';
import type {
  ClaimableQueryDto,
  CreateStoreDto,
  CreateStoreResponseDto,
  MyStoreResponseDto,
  NearbyQueryDto,
  NearbyStoresResponseDto,
  OpeningHoursDto,
  StoreResponseDto,
  UpdateStoreDto,
} from './stores.dto.js';
import { StoresGeoRepository, type StoreRow } from './stores-geo.repository.js';
import {
  parseCnpj,
  toResponse,
  VerificationService,
} from './verification.service.js';

/** DTO instances → plain JSON with only the known days and fields. */
export function toOpeningHours(
  dto: OpeningHoursDto | undefined,
): OpeningHours | undefined {
  if (!dto) return undefined;
  const weekly: NonNullable<OpeningHours['weekly']> = {};
  for (const day of WEEK_DAYS) {
    const ranges = dto.weekly?.[day];
    if (ranges)
      weekly[day] = ranges.map(({ open, close }) => ({ open, close }));
  }
  return { weekly };
}

export function toStoreResponse(row: StoreRow): StoreResponseDto {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj,
    source: row.source,
    verificationStatus: row.verificationStatus,
    lat: Number(row.lat),
    lng: Number(row.lng),
    address: row.address,
    openingHours: row.openingHours as Record<string, unknown> | null,
    categories: row.categories,
    managed: row.managed,
    ...(row.distanceKm === undefined
      ? {}
      : { distanceKm: Math.round(Number(row.distanceKm) * 100) / 100 }),
  };
}

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: StoresGeoRepository,
    private readonly discovery: DiscoveryService,
    private readonly verification: VerificationService,
  ) {}

  /** Public: stores already known around a point; kicks off discovery of new ones. */
  async nearby(query: NearbyQueryDto): Promise<NearbyStoresResponseDto> {
    const pendingAreas = await this.discovery.ensureArea(
      query.lat,
      query.lng,
      query.radiusKm,
    );
    const rows = await this.geo.findNearby(
      query.lat,
      query.lng,
      query.radiusKm,
    );
    return { stores: rows.map(toStoreResponse), pendingAreas };
  }

  /** Merchant onboarding: stores near the shop that may already be theirs. */
  async claimable(query: ClaimableQueryDto): Promise<StoreResponseDto[]> {
    await this.discovery.ensureArea(query.lat, query.lng, 1);
    // The merchant typed the shop address: candidates are a short walk away.
    return (
      await this.geo.findClaimable(query.lat, query.lng, query.q, 0.3)
    ).map(toStoreResponse);
  }

  async mine(userId: string): Promise<MyStoreResponseDto[]> {
    const memberships = await this.prisma.storeMember.findMany({
      where: { userId },
      select: { storeId: true, memberRole: true },
    });
    const roles = new Map(memberships.map((m) => [m.storeId, m.memberRole]));
    const rows = await this.geo.findManyByIds([...roles.keys()]);
    return rows.map((row) => ({
      ...toStoreResponse(row),
      memberRole: roles.get(row.id)!,
    }));
  }

  /**
   * "Minha loja não aparece no mapa": registers it with the merchant as OWNER.
   * Refuses likely duplicates (same CNPJ, or < 50 m with a similar name) so
   * the merchant claims the existing store instead.
   */
  async create(
    userId: string,
    dto: CreateStoreDto,
  ): Promise<CreateStoreResponseDto> {
    const cnpj = dto.cnpj ? parseCnpj(dto.cnpj) : null;
    if (cnpj) await this.verification.assertCnpjFree(cnpj);
    if (!dto.confirmNotDuplicate) {
      const duplicate = await this.geo.findDuplicate({
        name: dto.name,
        lat: dto.lat,
        lng: dto.lng,
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'POSSIBLE_DUPLICATE',
          message:
            'A store with a similar name already exists at this spot; claim it instead',
          storeId: duplicate.id,
          storeName: duplicate.name,
        });
      }
    }
    const categoryIds = await this.categoryIds(dto.categorySlugs);

    const storeId = await this.prisma.$transaction(async (tx) => {
      const id = await this.geo.create(
        {
          name: dto.name,
          source: 'MERCHANT_REGISTERED',
          lat: dto.lat,
          lng: dto.lng,
          address: { ...dto.address },
          openingHours: toOpeningHours(dto.openingHours),
        },
        tx,
      );
      await tx.storeMember.create({
        data: { storeId: id, userId, memberRole: 'OWNER' },
      });
      if (categoryIds.length > 0) {
        await tx.storeCategory.createMany({
          data: categoryIds.map((categoryId) => ({ storeId: id, categoryId })),
        });
      }
      return id;
    });

    let verification: CreateStoreResponseDto['verification'] = null;
    let verificationError: string | null = null;
    if (cnpj) {
      try {
        const { company, decision } = await this.verification.check(cnpj, {
          name: dto.name,
          address: dto.address,
        });
        await this.verification.apply(storeId, cnpj, company, decision);
        verification = toResponse(company, decision);
      } catch (error) {
        // The store exists either way; the merchant can retry the CNPJ later.
        verificationError =
          error instanceof HttpException
            ? this.reason(error)
            : 'CNPJ check failed';
      }
    }

    const row = await this.geo.findById(storeId);
    return { store: toStoreResponse(row!), verification, verificationError };
  }

  async update(
    storeId: string,
    dto: UpdateStoreDto,
  ): Promise<StoreResponseDto> {
    const current = await this.geo.findById(storeId);
    if (!current) throw new NotFoundException('Store not found');
    if ((dto.lat === undefined) !== (dto.lng === undefined)) {
      throw new BadRequestException('Send lat and lng together');
    }
    const categoryIds = dto.categorySlugs
      ? await this.categoryIds(dto.categorySlugs)
      : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.store.update({
        where: { id: storeId },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.address ? { address: { ...dto.address } } : {}),
          ...(dto.openingHours
            ? {
                openingHours: toOpeningHours(
                  dto.openingHours,
                ) as Prisma.InputJsonObject,
              }
            : {}),
        },
      });
      if (dto.lat !== undefined && dto.lng !== undefined) {
        await this.geo.updateLocation(storeId, dto.lat, dto.lng, tx);
      }
      if (categoryIds) {
        await tx.storeCategory.deleteMany({ where: { storeId } });
        await tx.storeCategory.createMany({
          data: categoryIds.map((categoryId) => ({ storeId, categoryId })),
        });
      }
    });
    return toStoreResponse((await this.geo.findById(storeId))!);
  }

  private async categoryIds(slugs: string[] | undefined): Promise<string[]> {
    if (!slugs || slugs.length === 0) return [];
    const unique = [...new Set(slugs)];
    const rows = await this.prisma.category.findMany({
      where: { slug: { in: unique } },
      select: { id: true, slug: true },
    });
    const missing = unique.filter(
      (slug) => !rows.some((row) => row.slug === slug),
    );
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'UNKNOWN_CATEGORY',
        message: `Unknown categories: ${missing.join(', ')}`,
      });
    }
    return rows.map((row) => row.id);
  }

  private reason(error: HttpException): string {
    const body = error.getResponse();
    return typeof body === 'object' && body && 'code' in body
      ? String(body.code)
      : error.message;
  }
}
