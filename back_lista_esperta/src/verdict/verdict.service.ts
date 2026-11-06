import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { demandCellKey } from '../common/demand-cell.js';
import type { Env } from '../config/env.schema.js';
import { RoutesService } from '../integrations/routes/routes.service.js';
import { SponsoredService } from '../sponsored/sponsored.service.js';
import { DiscoveryService } from '../stores/discovery.service.js';
import {
  StoresGeoRepository,
  type StoreRow,
} from '../stores/stores-geo.repository.js';
import { computeVerdict, type EngineItem, type EngineStore } from './engine.js';
import { isOpenAt } from './opening-hours.js';
import { WebPricesRepository } from '../web-prices/web-prices.repository.js';
import type {
  RankedStoreDto,
  ResolvedItemDto,
  SplitDto,
  VerdictRequestDto,
  VerdictResponseDto,
  VerdictStoreDto,
} from './verdict.dto.js';
import {
  type CurrentPriceRow,
  VerdictRepository,
} from './verdict.repository.js';

/** Stores routed and compared per verdict, closest first (keeps the route matrix small). */
const MAX_ROUTED_STORES = 30;

function storeDto(row: StoreRow, openNow: boolean | null): VerdictStoreDto {
  return {
    id: row.id,
    name: row.name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    address: row.address,
    verificationStatus: row.verificationStatus,
    openNow,
  };
}

@Injectable()
export class VerdictService {
  /** Each device counts once per day and area in the anonymous demand. Hashes only, in memory. */
  private demandSeen = { day: '', keys: new Set<string>() };

  constructor(
    private readonly repo: VerdictRepository,
    private readonly geo: StoresGeoRepository,
    private readonly routes: RoutesService,
    private readonly discovery: DiscoveryService,
    private readonly sponsored: SponsoredService,
    private readonly config: ConfigService<Env, true>,
    private readonly webPrices: WebPricesRepository,
  ) {}

  async compute(
    input: VerdictRequestDto,
    actorKey: string,
    now = new Date(),
  ): Promise<VerdictResponseDto> {
    const radiusKm = input.radiusKm ?? 5;
    const params = {
      splitMinSavings: this.config.get('VERDICT_SPLIT_MIN_SAVINGS', {
        infer: true,
      }),
      splitMinShare: this.config.get('VERDICT_SPLIT_MIN_SHARE', {
        infer: true,
      }),
      splitCandidates: 8,
    };

    // 1. What the person asked for → catalog products.
    const resolved = await Promise.all(
      input.items.map(async (item, index) => {
        const product = item.productId
          ? { id: item.productId, canonicalName: null }
          : await this.repo.matchText(item.text);
        return {
          index,
          text: item.text,
          quantity: item.quantity ?? 1,
          productId: product?.id ?? null,
          productName: product?.canonicalName ?? null,
        };
      }),
    );
    const productIds = [
      ...new Set(
        resolved.flatMap((item) => (item.productId ? [item.productId] : [])),
      ),
    ];

    // 2. Stores around the person, open now when they publish hours.
    const pendingAreas = await this.discovery.ensureArea(
      input.origin.lat,
      input.origin.lng,
      radiusKm,
    );
    const nearby = await this.geo.findNearby(
      input.origin.lat,
      input.origin.lng,
      radiusKm,
    );
    const prices = await this.repo.currentPrices(
      nearby.map((s) => s.id),
      productIds,
    );
    const withPrices = new Set(prices.map((p) => p.storeId));
    let storesClosed = 0;
    const candidates = nearby
      .filter((store) => withPrices.has(store.id))
      .map((store) => ({
        store,
        openNow: isOpenAt(store.openingHours, now),
      }))
      .filter(({ openNow }) => {
        if (openNow === false) storesClosed += 1;
        return openNow !== false;
      })
      .slice(0, MAX_ROUTED_STORES);

    // 3. Travel, then the engine.
    const matrix = await this.routes.matrix(
      input.origin,
      candidates.map(({ store }) => ({
        id: store.id,
        lat: Number(store.lat),
        lng: Number(store.lng),
      })),
    );
    const priceByStore = new Map<
      string,
      Map<string, (typeof prices)[number]>
    >();
    for (const price of prices) {
      if (!priceByStore.has(price.storeId))
        priceByStore.set(price.storeId, new Map());
      priceByStore.get(price.storeId)!.set(price.productId, price);
    }
    const engineStores: EngineStore[] = candidates.map(({ store }) => ({
      id: store.id,
      km: matrix.fromOrigin.get(store.id)!.km,
      minutes: matrix.fromOrigin.get(store.id)!.minutes,
      prices: priceByStore.get(store.id) ?? new Map<string, CurrentPriceRow>(),
    }));
    const engineItems: EngineItem[] = resolved.map(
      ({ index, productId, quantity }) => ({ index, productId, quantity }),
    );
    const result = computeVerdict(
      engineItems,
      engineStores,
      (a, b) => matrix.between(a, b),
      params,
    );

    // 4. Response. Sponsored content is picked after the ranking and kept apart.
    const byId = new Map(candidates.map((c) => [c.store.id, c]));
    const ranking: RankedStoreDto[] = result.ranking.map((totals) => {
      const { store, openNow } = byId.get(totals.storeId)!;
      const storePrices =
        priceByStore.get(store.id) ?? new Map<string, CurrentPriceRow>();
      return {
        store: storeDto(store, openNow),
        ...totals,
        lines: resolved.map((item) => {
          const price = item.productId
            ? storePrices.get(item.productId)
            : undefined;
          return {
            index: item.index,
            unitPrice: price?.price ?? null,
            subtotal: price
              ? Math.round(price.price * item.quantity * 100) / 100
              : null,
            evidence: price
              ? {
                  source: price.source,
                  observedAt: price.observedAt.toISOString(),
                  receiptCount: price.receiptCount,
                  offer: price.offer,
                }
              : null,
          };
        }),
      };
    });
    // Shown beside each item; computed after the ranking and never fed to it.
    const webPrices = await Promise.all(
      resolved.map(async (item) => {
        const found =
          (await this.webPrices.cheapestFor(item.text, input.origin, now)) ??
          (item.productName
            ? await this.webPrices.cheapestFor(
                item.productName,
                input.origin,
                now,
              )
            : null);
        return found ? { ...found, seenAt: found.seenAt.toISOString() } : null;
      }),
    );
    const items: ResolvedItemDto[] = resolved.map((item) => ({
      ...item,
      webPrice: webPrices[item.index],
      priced: Boolean(item.productId && result.medians.has(item.productId)),
      regionalMedian: item.productId
        ? (result.medians.get(item.productId) ?? null)
        : null,
    }));
    const plan = result.split;
    const split: SplitDto | null = plan
      ? {
          stores: plan.storeIds.map((id) =>
            storeDto(byId.get(id)!.store, byId.get(id)!.openNow),
          ),
          assignment: Object.fromEntries(
            Object.entries(plan.assignment).map(([index, storeId]) => [
              index,
              storeId,
            ]),
          ),
          itemsCost: plan.itemsCost,
          missingPenalty: plan.missingPenalty,
          travelKm: plan.travelKm,
          travelMinutes: plan.travelMinutes,
          totalCost: plan.totalCost,
          savings: plan.savings,
        }
      : null;
    const sponsored = await this.sponsored.forVerdict({
      storeIds: ranking.map((r) => r.store.id),
      productIds,
    });

    await this.recordDemand(productIds, input.origin, actorKey, now);

    return {
      items,
      ranking,
      split,
      params: {
        radiusKm,
        splitMinSavings: params.splitMinSavings,
        splitMinShare: params.splitMinShare,
        routing: matrix.source,
        storesConsidered: candidates.length,
        storesClosed,
        pendingAreas,
      },
      sponsored,
      computedAt: now.toISOString(),
    };
  }

  private async recordDemand(
    productIds: string[],
    origin: { lat: number; lng: number },
    actorKey: string,
    now: Date,
  ) {
    const day = now.toISOString().slice(0, 10);
    if (this.demandSeen.day !== day) this.demandSeen = { day, keys: new Set() };
    const cell = demandCellKey(origin.lat, origin.lng);
    const key = createHash('sha256')
      .update(`${day}|${cell}|${actorKey}`)
      .digest('hex');
    if (this.demandSeen.keys.has(key)) return;
    this.demandSeen.keys.add(key);
    await this.repo.recordDemand(productIds, cell);
  }
}
