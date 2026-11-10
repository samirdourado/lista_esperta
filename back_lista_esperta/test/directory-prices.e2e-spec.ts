import request from 'supertest';
import {
  type DirectoryProductPrices,
  PRICE_DIRECTORY,
} from '../src/integrations/precomelhor/precomelhor.service.js';
import { GEOCODING_PROVIDER } from '../src/integrations/providers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, type TestApp } from './helpers.js';

const HERE = { lat: -23.5891, lng: -46.6346 };
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const shop = (id: string, km: number, price: number, age = 1) => ({
  storeId: id,
  storeName: `Mercado ${id}`,
  lat: HERE.lat - km / 111.32,
  lng: HERE.lng,
  price,
  observedAt: daysAgo(age),
});

const catalog = new Map<string, DirectoryProductPrices>([
  [
    '7890000000001',
    {
      name: 'Arroz Camil 5kg',
      imageUrl: 'https://img.example/arroz.webp',
      prices: [
        shop('a', 1, 25),
        shop('b', 2, 28),
        shop('old', 1, 10, 60),
        shop('longe', 30, 20),
      ],
    },
  ],
  [
    '7890000000002',
    {
      name: 'Arroz Tio João 5kg',
      imageUrl: null,
      // 'c' has a data error: far above every other brand of the item.
      prices: [shop('b', 2, 26), shop('c', 1.5, 260)],
    },
  ],
  [
    '7890000000003',
    {
      name: 'Café Pilão 500g',
      imageUrl: 'https://img.example/cafe.webp',
      prices: [shop('a', 1, 18)],
    },
  ],
]);

const directory = {
  enabled: true,
  search: (query: string) =>
    Promise.resolve(
      query.startsWith('arroz')
        ? [
            {
              ean: '7890000000001',
              name: 'Arroz Camil 5kg',
              imageUrl: null,
              storeCount: 90,
            },
            {
              ean: '7890000000002',
              name: 'Arroz Tio João 5kg',
              imageUrl: null,
              storeCount: 50,
            },
            {
              ean: '7890000000009',
              name: 'Arroz Doce 200g',
              imageUrl: null,
              storeCount: 99,
            },
          ]
        : [],
    ),
  prices: (ean: string) => Promise.resolve(catalog.get(ean) ?? null),
};

const geocoding = {
  search: () => Promise.resolve([]),
  reverse: () =>
    Promise.resolve({
      label: 'Rua A, Paraíso',
      lat: HERE.lat,
      lng: HERE.lng,
      address: { street: 'Rua A', district: 'Paraíso', city: 'São Paulo' },
    }),
};

describe('Prices from the store directory (e2e)', () => {
  let app: TestApp;
  const verdict = (items: object[]) =>
    request(app.getHttpServer())
      .post('/api/v1/verdict')
      .send({ origin: HERE, radiusKm: 5, items })
      .expect(200);

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [
        { token: PRICE_DIRECTORY, value: directory },
        { token: GEOCODING_PROVIDER, value: geocoding },
      ],
    });
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('ranks real stores in the radius, with photo and name, and flags what is missing', async () => {
    const res = await verdict([
      { text: 'Café Pilão 500g', ean: '7890000000003', quantity: 2 },
      { text: 'arroz 5kg' },
    ]);
    const names = res.body.ranking.map(
      (r: { store: { name: string } }) => r.store.name,
    );
    // Too far, too old and absurd prices are out; every store sells something on the list.
    expect(names.sort()).toEqual(['Mercado a', 'Mercado b']);

    const a = res.body.ranking.find(
      (r: { store: { name: string } }) => r.store.name === 'Mercado a',
    );
    expect(a).toMatchObject({ itemsCost: 61, found: 2, priced: 2 });
    expect(a.lines[0]).toMatchObject({
      productName: 'Café Pilão 500g',
      imageUrl: 'https://img.example/cafe.webp',
      subtotal: 36,
      evidence: { source: 'PRECOMELHOR' },
    });

    const b = res.body.ranking.find(
      (r: { store: { name: string } }) => r.store.name === 'Mercado b',
    );
    // The cheapest brand of a typed item, and a clear "not here" for the coffee.
    expect(b.lines[1]).toMatchObject({
      productName: 'Arroz Tio João 5kg',
      unitPrice: 26,
    });
    expect(b.lines[0]).toMatchObject({ unitPrice: null, evidence: null });
    expect(b.missing).toEqual([0]);
  });

  it('keeps each store once and fills its address in the background', async () => {
    const items = [{ text: 'arroz 5kg' }];
    const first = await verdict(items);
    expect(first.body.params.addressesPending).toBe(2);
    await verdict(items);
    const prisma = app.get(PrismaService);
    expect(await prisma.store.count({ where: { source: 'PRECOMELHOR' } })).toBe(
      2,
    );
    await expect
      .poll(async () => (await verdict(items)).body.params.addressesPending)
      .toBe(0);
    const again = await verdict(items);
    expect(again.body.ranking[0].store.address).toMatchObject({
      street: 'Rua A',
    });
    // Prices are read live, not copied into our history.
    expect(await prisma.priceObservation.count()).toBe(0);
  });

  it('uses the store prices the browser read, checked here first', async () => {
    const row = (id: string, km: number, price: number, age = 1) => ({
      ...shop(id, km, price, age),
      observedAt: daysAgo(age).toISOString(),
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/verdict')
      .send({
        origin: HERE,
        radiusKm: 5,
        items: [{ text: 'Leite Italac 1L', ean: '7890000000077' }],
        directory: [
          {
            index: 0,
            products: [
              {
                ean: '7890000000077',
                name: 'Leite Italac 1L',
                imageUrl: 'https://img.example/leite.webp',
                nationalMedian: 5,
                prices: [
                  row('perto', 1, 4.79),
                  row('caro', 2, 79.9), // data error: 16× the national median
                  row('antigo', 1, 3.5, 45),
                  row('longe', 12, 3.9),
                ],
              },
            ],
          },
        ],
      })
      .expect(200);
    expect(
      res.body.ranking.map((r: { store: { name: string } }) => r.store.name),
    ).toEqual(['Mercado perto']);
    expect(res.body.ranking[0].lines[0]).toMatchObject({
      productName: 'Leite Italac 1L',
      unitPrice: 4.79,
      evidence: { source: 'PRECOMELHOR' },
    });

    // Malformed data is refused.
    await request(app.getHttpServer())
      .post('/api/v1/verdict')
      .send({
        origin: HERE,
        items: [{ text: 'leite' }],
        directory: [
          { index: 0, products: [{ ean: 'x', name: 'y', prices: [] }] },
        ],
      })
      .expect(400);
  });

  it('shows products with barcode in the list search, without Google', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/web-prices')
      .query({ q: 'arroz', lat: HERE.lat, lng: HERE.lng })
      .expect(200);
    expect(res.body.source).toBe('PRECOMELHOR');
    expect(
      res.body.offers.map((o: { ean: string; price: number }) => [
        o.ean,
        o.price,
      ]),
    ).toEqual([
      ['7890000000001', 25],
      ['7890000000002', 26],
    ]);
  });
});
