import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoresGeoRepository } from '../stores/stores-geo.repository.js';
import { VerdictRepository } from '../verdict/verdict.repository.js';
import type {
  AlertBestPriceDto,
  CreateAlertDto,
  PriceAlertDto,
  PushSubscriptionDto,
  UpdateAlertDto,
} from './alerts.dto.js';
import {
  PUSH_SENDER,
  type PushMessage,
  type PushSender,
} from './push.service.js';

const brl = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

type AlertRow = Awaited<ReturnType<AlertsService['findAlerts']>>[number];

/**
 * Price alerts for signed-in shoppers (spec section 3: an account perk).
 * A periodic check compares each alert with the lowest current price around
 * it, using the verdict's price rule, and pushes once per new low.
 */
@Injectable()
export class AlertsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AlertsService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: StoresGeoRepository,
    private readonly prices: VerdictRepository,
    private readonly config: ConfigService<Env, true>,
    @Inject(PUSH_SENDER) private readonly push: PushSender,
  ) {}

  onApplicationBootstrap(): void {
    const minutes = this.config.get('ALERTS_CHECK_MINUTES', { infer: true });
    if (minutes <= 0) return;
    this.timer = setInterval(() => void this.checkAll(), minutes * 60_000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  get publicKey(): string | null {
    return this.push.enabled ? this.push.publicKey : null;
  }

  async subscribe(userId: string, dto: PushSubscriptionDto): Promise<void> {
    // An endpoint belongs to one browser: whoever signs in there last gets it.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: { userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async sendTest(userId: string): Promise<number> {
    return this.notify(userId, {
      title: 'Lista Esperta',
      body: 'Os avisos de preço estão ligados neste aparelho.',
      url: '/alerts',
      tag: 'test',
    });
  }

  async list(userId: string): Promise<PriceAlertDto[]> {
    const alerts = await this.findAlerts({ userId });
    return Promise.all(
      alerts.map(async (alert) => toDto(alert, await this.bestPrice(alert))),
    );
  }

  async create(userId: string, dto: CreateAlertDto): Promise<PriceAlertDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product)
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found',
      });
    const data = {
      targetPrice: dto.targetPrice,
      lat: dto.origin.lat,
      lng: dto.origin.lng,
      radiusKm: dto.radiusKm ?? 5,
      active: true,
      notifiedPrice: null,
      notifiedAt: null,
    };
    const row = await this.prisma.priceAlert.upsert({
      where: { userId_productId: { userId, productId: dto.productId } },
      create: { userId, productId: dto.productId, ...data },
      update: data,
      include: { product: { select: { id: true, canonicalName: true } } },
    });
    return toDto(row, await this.bestPrice(row));
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAlertDto,
  ): Promise<PriceAlertDto> {
    await this.owned(userId, id);
    const row = await this.prisma.priceAlert.update({
      where: { id },
      data: {
        ...dto,
        // A new target or area deserves a fresh notification.
        ...(dto.targetPrice !== undefined || dto.radiusKm !== undefined
          ? { notifiedPrice: null, notifiedAt: null }
          : {}),
      },
      include: { product: { select: { id: true, canonicalName: true } } },
    });
    return toDto(row, await this.bestPrice(row));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.prisma.priceAlert.delete({ where: { id } });
  }

  /** Runs every ALERTS_CHECK_MINUTES; also called directly by tests. */
  async checkAll(): Promise<{ checked: number; notified: number }> {
    if (this.running) return { checked: 0, notified: 0 };
    this.running = true;
    let notified = 0;
    try {
      const alerts = await this.findAlerts({ active: true });
      for (const alert of alerts) {
        const best = await this.bestPrice(alert);
        const target = Number(alert.targetPrice);
        const last =
          alert.notifiedPrice === null ? null : Number(alert.notifiedPrice);
        if (best && best.price <= target) {
          if (last !== null && best.price >= last) continue;
          const sent = await this.notify(alert.userId, {
            title: `${alert.product.canonicalName} por ${brl(best.price)}`,
            body: `${best.storeName}, a ${best.distanceKm.toFixed(1).replace('.', ',')} km. Seu alerta: até ${brl(target)}.`,
            url: '/alerts',
            tag: `alert-${alert.id}`,
          });
          // Remember the price even with no device: the alert page shows it.
          await this.prisma.priceAlert.update({
            where: { id: alert.id },
            data: { notifiedPrice: best.price, notifiedAt: new Date() },
          });
          if (sent > 0) notified += 1;
        } else if (last !== null) {
          // The price went back up: the next drop notifies again.
          await this.prisma.priceAlert.update({
            where: { id: alert.id },
            data: { notifiedPrice: null },
          });
        }
      }
      return { checked: alerts.length, notified };
    } catch (error) {
      this.logger.warn(
        `Alert check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { checked: 0, notified };
    } finally {
      this.running = false;
    }
  }

  private findAlerts(where: { userId?: string; active?: boolean }) {
    return this.prisma.priceAlert.findMany({
      where,
      include: { product: { select: { id: true, canonicalName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async owned(userId: string, id: string): Promise<void> {
    const alert = await this.prisma.priceAlert.findUnique({
      where: { id },
      select: { userId: true },
    });
    // Someone else's alert looks the same as a missing one.
    if (!alert || alert.userId !== userId)
      throw new NotFoundException({
        code: 'ALERT_NOT_FOUND',
        message: 'Alert not found',
      });
  }

  private async bestPrice(alert: {
    productId: string;
    lat: number;
    lng: number;
    radiusKm: unknown;
  }): Promise<AlertBestPriceDto | null> {
    const stores = await this.geo.findNearby(
      alert.lat,
      alert.lng,
      Number(alert.radiusKm),
    );
    const rows = await this.prices.currentPrices(
      stores.map((store) => store.id),
      [alert.productId],
    );
    let best: AlertBestPriceDto | null = null;
    for (const row of rows) {
      const store = stores.find((s) => s.id === row.storeId);
      if (!store) continue;
      const distanceKm = Number(store.distanceKm ?? 0);
      if (
        !best ||
        row.price < best.price ||
        (row.price === best.price && distanceKm < best.distanceKm)
      )
        best = {
          price: row.price,
          storeId: store.id,
          storeName: store.name,
          distanceKm,
          source: row.source,
        };
    }
    return best;
  }

  /** Sends to every device of the user; forgets devices the browser dropped. */
  private async notify(userId: string, message: PushMessage): Promise<number> {
    if (!this.push.enabled) return 0;
    const targets = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    let sent = 0;
    for (const target of targets) {
      const result = await this.push.send(target, message);
      if (result === 'sent') sent += 1;
      if (result === 'gone')
        await this.prisma.pushSubscription.delete({ where: { id: target.id } });
    }
    return sent;
  }
}

function toDto(alert: AlertRow, best: AlertBestPriceDto | null): PriceAlertDto {
  return {
    id: alert.id,
    product: alert.product,
    targetPrice: Number(alert.targetPrice),
    radiusKm: Number(alert.radiusKm),
    origin: { lat: alert.lat, lng: alert.lng },
    active: alert.active,
    best,
    notifiedAt: alert.notifiedAt?.toISOString() ?? null,
    createdAt: alert.createdAt.toISOString(),
  };
}
