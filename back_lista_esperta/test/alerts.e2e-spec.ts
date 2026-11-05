import request from 'supertest';
import { AlertsService } from '../src/alerts/alerts.service.js';
import {
  PUSH_SENDER,
  type PushMessage,
  type PushResult,
} from '../src/alerts/push.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StoresGeoRepository } from '../src/stores/stores-geo.repository.js';
import {
  createTestApp,
  resetDatabase,
  signUp,
  type SignedInAgent,
  type TestApp,
} from './helpers.js';

const push = {
  enabled: true,
  publicKey: 'BPublicKeyForTests',
  result: 'sent' as PushResult,
  sent: [] as PushMessage[],
  send(_target: unknown, message: PushMessage): Promise<PushResult> {
    this.sent.push(message);
    return Promise.resolve(this.result);
  },
};

const SUBSCRIPTION = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
};
const ORIGIN = { lat: -23.5891, lng: -46.6346 };

describe('Price alerts (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let alerts: AlertsService;
  let shopper: SignedInAgent;
  let milk: string;
  let near: string;

  const price = (value: number) =>
    prisma.priceObservation.create({
      data: { storeId: near, productId: milk, price: value, source: 'NFCE' },
    });

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [{ token: PUSH_SENDER, value: push }],
    });
    prisma = app.get(PrismaService);
    alerts = app.get(AlertsService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    push.sent = [];
    push.result = 'sent';
    const category = await prisma.category.create({
      data: { slug: 'mercearia', name: 'Mercearia' },
    });
    milk = (
      await prisma.product.create({
        data: {
          canonicalName: 'Leite UHT integral 1 L',
          categoryId: category.id,
          unit: 'L',
          unitQuantity: 1,
        },
      })
    ).id;
    near = await app.get(StoresGeoRepository).create({
      name: 'Mercado Perto',
      source: 'OSM',
      lat: -23.5935,
      lng: -46.6346,
    });
    await price(5.2);
    shopper = await signUp(app, 'cliente@lista.dev');
  });

  afterAll(async () => {
    await app.close();
  });

  it('needs an account, except for the public key', async () => {
    const guest = request(app.getHttpServer());
    const key = await guest.get('/api/v1/push/public-key').expect(200);
    expect(key.body).toEqual({ publicKey: 'BPublicKeyForTests' });
    await guest.get('/api/v1/alerts').expect(401);
    await guest
      .post('/api/v1/push/subscriptions')
      .send(SUBSCRIPTION)
      .expect(401);
  });

  it('pushes once per new low near the shopper, and again after the price goes back up', async () => {
    await shopper.agent
      .post('/api/v1/push/subscriptions')
      .send(SUBSCRIPTION)
      .expect(204);
    const created = await shopper.agent
      .post('/api/v1/alerts')
      .send({ productId: milk, targetPrice: 5, origin: ORIGIN })
      .expect(201);
    expect(created.body).toMatchObject({
      targetPrice: 5,
      radiusKm: 5,
      best: { price: 5.2, storeName: 'Mercado Perto' },
    });

    expect(await alerts.checkAll()).toEqual({ checked: 1, notified: 0 });
    await price(4.8);
    expect(await alerts.checkAll()).toEqual({ checked: 1, notified: 1 });
    expect(push.sent[0]).toMatchObject({
      title: 'Leite UHT integral 1 L por R$ 4,80',
      url: '/alerts',
    });
    expect(push.sent[0].body).toMatch(
      /^Mercado Perto, a 0,5 km\. Seu alerta: até R\$ 5,00\.$/,
    );

    // Same price: no repeat. Lower price: a new push.
    await alerts.checkAll();
    expect(push.sent).toHaveLength(1);
    await price(4.5);
    await alerts.checkAll();
    expect(push.sent).toHaveLength(2);

    // Back above the target, then down again: notifies again.
    await price(6);
    await alerts.checkAll();
    await price(4.5);
    await alerts.checkAll();
    expect(push.sent).toHaveLength(3);

    const list = await shopper.agent.get('/api/v1/alerts').expect(200);
    expect(list.body[0].notifiedAt).not.toBeNull();
  });

  it('forgets devices the browser dropped', async () => {
    await shopper.agent
      .post('/api/v1/push/subscriptions')
      .send(SUBSCRIPTION)
      .expect(204);
    push.result = 'gone';
    const res = await shopper.agent.post('/api/v1/push/test').expect(200);
    expect(res.body).toEqual({ sent: 0 });
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it("keeps each shopper's alerts private", async () => {
    const created = await shopper.agent
      .post('/api/v1/alerts')
      .send({ productId: milk, targetPrice: 5, origin: ORIGIN })
      .expect(201);
    const other = await signUp(app, 'outra@lista.dev');
    expect((await other.agent.get('/api/v1/alerts').expect(200)).body).toEqual(
      [],
    );
    await other.agent.delete(`/api/v1/alerts/${created.body.id}`).expect(404);
    await other.agent
      .patch(`/api/v1/alerts/${created.body.id}`)
      .send({ active: false })
      .expect(404);
    await shopper.agent
      .patch(`/api/v1/alerts/${created.body.id}`)
      .send({ active: false })
      .expect(200);
    expect(await alerts.checkAll()).toEqual({ checked: 0, notified: 0 });
    await shopper.agent.delete(`/api/v1/alerts/${created.body.id}`).expect(204);
  });
});
