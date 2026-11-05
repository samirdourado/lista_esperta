import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cellFromKey, cellsForCircle } from '../common/geo-cell.js';
import type { Env } from '../config/env.schema.js';
import {
  PLACES_PROVIDER,
  type PlacesProvider,
} from '../integrations/providers.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoresGeoRepository } from './stores-geo.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_FAILED_AFTER_MS = 10 * 60 * 1000;
/** Discovery is capped: a wide radius still only imports the nearest cells. */
const MAX_CELLS_PER_REQUEST = 16;

/**
 * Imports shops from the places provider (OpenStreetMap) into `stores`, one
 * ~5 km cell at a time, in the background. Public Overpass servers can take
 * 30 s+ per query, so nobody waits on them: /stores/nearby answers with what
 * is already stored and reports how many cells are still being fetched.
 */
@Injectable()
export class DiscoveryService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly queue: string[] = [];
  private readonly queued = new Set<string>();
  private worker: Promise<void> | null = null;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: StoresGeoRepository,
    private readonly config: ConfigService<Env, true>,
    @Inject(PLACES_PROVIDER) private readonly places: PlacesProvider,
  ) {}

  private get enabled() {
    return this.config.get('DISCOVERY_ENABLED', { infer: true });
  }

  /** After a restart, finish the cells that were still pending. */
  async onModuleInit(): Promise<void> {
    if (!this.enabled) return;
    const pending = await this.prisma.placeDiscoveryCell.findMany({
      where: { status: 'PENDING' },
      select: { cellKey: true },
    });
    pending.forEach(({ cellKey }) => this.enqueue(cellKey));
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    await this.worker;
  }

  /**
   * Makes sure the cells around a point are (being) imported.
   * Returns how many of them are still pending.
   */
  async ensureArea(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<number> {
    if (!this.enabled) return 0;
    const keys = cellsForCircle(lat, lng, radiusKm)
      .slice(0, MAX_CELLS_PER_REQUEST)
      .map((cell) => cell.key);
    const known = await this.prisma.placeDiscoveryCell.findMany({
      where: { cellKey: { in: keys } },
    });
    const byKey = new Map(known.map((row) => [row.cellKey, row]));
    const ttlMs =
      this.config.get('DISCOVERY_TTL_DAYS', { infer: true }) * DAY_MS;
    const now = Date.now();
    let pending = 0;

    for (const key of keys) {
      const row = byKey.get(key);
      const stale =
        !row ||
        (row.status === 'DONE' &&
          (row.fetchedAt?.getTime() ?? 0) < now - ttlMs) ||
        (row.status === 'FAILED' &&
          row.updatedAt.getTime() < now - RETRY_FAILED_AFTER_MS) ||
        (row.status === 'PENDING' && !this.queued.has(key));
      if (stale) {
        await this.prisma.placeDiscoveryCell.upsert({
          where: { cellKey: key },
          create: { cellKey: key, status: 'PENDING' },
          update: { status: 'PENDING' },
        });
        this.enqueue(key);
      }
      if (stale || row?.status === 'PENDING') pending += 1;
    }
    return pending;
  }

  /** Resolves when the queue is empty. Used by tests and scripts. */
  async drain(): Promise<void> {
    while (this.worker) await this.worker;
  }

  private enqueue(key: string): void {
    if (this.queued.has(key)) return;
    this.queued.add(key);
    this.queue.push(key);
    this.worker ??= this.work().finally(() => {
      this.worker = null;
    });
  }

  private async work(): Promise<void> {
    while (this.queue.length > 0 && !this.stopping) {
      const key = this.queue.shift()!;
      try {
        await this.importCell(key);
      } finally {
        this.queued.delete(key);
      }
    }
  }

  private async importCell(key: string): Promise<void> {
    const started = Date.now();
    try {
      const candidates = await this.places.fetchArea(cellFromKey(key));
      const categories = await this.categoryIdsBySlug();
      let stored = 0;
      for (const place of candidates) {
        const row = await this.geo.upsertDiscoveredPlace(
          this.places.source,
          place,
        );
        if (!row) continue;
        stored += 1;
        const categoryIds = place.categorySlugs
          .map((slug) => categories.get(slug))
          .filter((id): id is string => Boolean(id));
        if (row.created && categoryIds.length > 0) {
          await this.prisma.storeCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              storeId: row.id,
              categoryId,
            })),
            skipDuplicates: true,
          });
        }
      }
      await this.prisma.placeDiscoveryCell.update({
        where: { cellKey: key },
        data: {
          status: 'DONE',
          storesFound: stored,
          fetchedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      this.logger.log(
        `Cell ${key}: ${stored} stores in ${Date.now() - started} ms`,
      );
    } catch (error) {
      await this.prisma.placeDiscoveryCell.update({
        where: { cellKey: key },
        data: { status: 'FAILED', attempts: { increment: 1 } },
      });
      this.logger.warn(
        `Cell ${key} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** One small query per cell; not cached so seed changes apply right away. */
  private async categoryIdsBySlug(): Promise<Map<string, string>> {
    const rows = await this.prisma.category.findMany({
      select: { id: true, slug: true },
    });
    return new Map(rows.map((row) => [row.slug, row.id]));
  }
}
