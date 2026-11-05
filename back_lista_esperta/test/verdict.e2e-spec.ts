import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { PRODUCT_NORMALIZER } from '../src/integrations/gemini/gemini.service.js';
import { GEOCODING_PROVIDER } from '../src/integrations/providers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SEFAZ_FETCHER } from '../src/receipts/sefaz-fetcher.js';
import { SponsoredService } from '../src/sponsored/sponsored.service.js';
import { StoresGeoRepository } from '../src/stores/stores-geo.repository.js';
import { createTestApp, resetDatabase, type TestApp } from './helpers.js';

const HERE = { lat: -23.5891, lng: -46.6346 };
const GUEST = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const KEY = '35261111222333000181650010000123451123456780';
const QR = `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${KEY}|2|1|1|ABC`;

const sponsored = {
  items: [] as unknown[],
  forVerdict() {
    return Promise.resolve(this.items);
  },
};

describe('Verdict (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let geo: StoresGeoRepository;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [
        {
          token: SEFAZ_FETCHER,
          value: {
            fetchPage: () =>
              Promise.resolve(
                readFileSync(
                  join(
                    process.cwd(),
                    'test/fixtures/nfce/sp-consulta-qrcode.html',
                  ),
                  'utf8',
                ),
              ),
          },
        },
        {
          token: PRODUCT_NORMALIZER,
          value: { enabled: false, normalize: () => Promise.resolve([]) },
        },
        {
          token: GEOCODING_PROVIDER,
          value: {
            search: () =>
              Promise.resolve([
                { label: 'x', lat: -23.5937, lng: -46.637, address: {} },
              ]),
            reverse: () => Promise.resolve(null),
          },
        },
        { token: SponsoredService, value: sponsored },
      ],
    });
    prisma = app.get(PrismaService);
    geo = app.get(StoresGeoRepository);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    sponsored.items = [];
    const category = await prisma.category.create({
      data: { slug: 'mercearia', name: 'Mercearia' },
    });
    const product = (canonicalName: string, gtin?: string) =>
      prisma.product.create({
        data: {
          canonicalName,
          gtin,
          categoryId: category.id,
          unit: 'UN',
          unitQuantity: 1,
        },
      });
    ids.milk = (
      await product('Leite UHT integral Itambé 1 L', '7896051111153')
    ).id;
    ids.rice = (await product('Arroz branco tipo 1 Camil 5 kg')).id;
    ids.soap = (await product('Sabão em pó 1 kg')).id;
    // Two shops 0.5 km and 1.1 km away, one closed all week, one 30 km away.
    ids.near = await geo.create({
      name: 'Mercado Perto',
      source: 'MERCHANT_REGISTERED',
      lat: -23.5935,
      lng: -46.6346,
    });
    ids.mid = await geo.create({
      name: 'Atacado Médio',
      source: 'OSM',
      lat: -23.5991,
      lng: -46.6346,
    });
    ids.closed = await geo.create({
      name: 'Fechado',
      source: 'OSM',
      lat: -23.5895,
      lng: -46.6346,
      openingHours: { weekly: {} },
    });
    ids.far = await geo.create({
      name: 'Muito Longe',
      source: 'OSM',
      lat: -23.85,
      lng: -46.6346,
    });
    await prisma.store.update({
      where: { id: ids.closed },
      data: { openingHours: { osm: 'Mo-Su off' } },
    });
    const price = (
      storeId: string,
      productId: string,
      value: number,
      source: 'MERCHANT' | 'COMMUNITY' = 'MERCHANT',
    ) =>
      prisma.priceObservation.create({
        data: { storeId, productId, price: value, source },
      });
    await price(ids.near, ids.milk, 6.0);
    await price(ids.near, ids.rice, 32.0);
    await price(ids.mid, ids.milk, 5.2);
    await price(ids.mid, ids.rice, 24.9);
    await price(ids.mid, ids.soap, 15.0);
    await price(ids.closed, ids.milk, 1.0);
    await price(ids.far, ids.milk, 1.0);
  });

  afterAll(async () => {
    await app.close();
  });

  const verdict = (body: object, guest = GUEST) =>
    request(app.getHttpServer())
      .post('/api/v1/verdict')
      .set('X-Guest-Id', guest)
      .send({ origin: HERE, ...body });

  it('ranks stores by total cost, inside the radius and open now, with an estimate when ORS is not set', async () => {
    const res = await verdict({
      items: [
        { productId: ids.milk, text: 'leite', quantity: 2 },
        { productId: ids.rice, text: 'arroz' },
      ],
    }).expect(200);
    expect(
      res.body.ranking.map((r: { store: { name: string } }) => r.store.name),
    ).toEqual(['Atacado Médio', 'Mercado Perto']);
    const [best] = res.body.ranking;
    expect(best).toMatchObject({
      itemsCost: 35.3,
      found: 2,
      priced: 2,
      missing: [],
    });
    expect(best.totalCost).toBeCloseTo(best.itemsCost + best.travelCost, 2);
    expect(best.lines[0]).toMatchObject({
      unitPrice: 5.2,
      subtotal: 10.4,
      evidence: { source: 'MERCHANT', offer: false },
    });
    expect(res.body.params).toMatchObject({
      radiusKm: 5,
      costPerKm: 1,
      routing: 'ESTIMATE',
      storesClosed: 1,
      storesConsidered: 2,
    });
  });

  it('penalizes missing items with the regional median and resolves typed text', async () => {
    const res = await verdict({
      items: [
        { text: 'sabão em pó' },
        { text: 'leite integral itambé' },
        { text: 'xyz inexistente' },
      ],
    }).expect(200);
    expect(
      res.body.items.map(
        (i: { productName: string | null; priced: boolean }) => [
          i.productName,
          i.priced,
        ],
      ),
    ).toEqual([
      ['Sabão em pó 1 kg', true],
      ['Leite UHT integral Itambé 1 L', true],
      [null, false],
    ]);
    const near = res.body.ranking.find(
      (r: { store: { name: string } }) => r.store.name === 'Mercado Perto',
    );
    expect(near).toMatchObject({
      found: 1,
      priced: 2,
      missing: [0],
      missingPenalty: 15,
    });
  });

  it('suggests two stores when it saves more than R$ 10 and 5 %', async () => {
    // Steak is cheap only at the near store; the rest is cheap at the mid store.
    const steak = (
      await prisma.product.create({
        data: {
          canonicalName: 'Contrafilé kg',
          categoryId: (await prisma.category.findFirstOrThrow()).id,
          unit: 'KG',
          unitQuantity: 1,
        },
      })
    ).id;
    await prisma.priceObservation.createMany({
      data: [
        { storeId: ids.near, productId: steak, price: 40, source: 'MERCHANT' },
        { storeId: ids.mid, productId: steak, price: 70, source: 'MERCHANT' },
      ],
    });
    const res = await verdict({
      items: [
        { productId: steak, text: 'contrafilé', quantity: 2 },
        { productId: ids.rice, text: 'arroz', quantity: 3 },
      ],
    }).expect(200);
    expect(res.body.split).not.toBeNull();
    expect(res.body.split.savings).toBeGreaterThan(10);
    expect(res.body.split.assignment).toEqual({ 0: ids.near, 1: ids.mid });
    expect(res.body.split.stores.map((s: { name: string }) => s.name)).toEqual([
      'Mercado Perto',
      'Atacado Médio',
    ]);
  });

  it('NEUTRALITY: sponsored content never changes the ranking and stays in its own block', async () => {
    const body = {
      items: [
        { productId: ids.milk, text: 'leite' },
        { productId: ids.rice, text: 'arroz' },
      ],
    };
    const plain = await verdict(
      body,
      '00000000-0000-4000-8000-000000000001',
    ).expect(200);
    sponsored.items = [
      {
        storeId: ids.near,
        storeName: 'Mercado Perto',
        title: 'Leite em oferta',
        label: 'Patrocinado',
      },
    ];
    const paid = await verdict(
      body,
      '00000000-0000-4000-8000-000000000002',
    ).expect(200);
    const order = (res: request.Response) =>
      res.body.ranking.map(
        (r: { store: { id: string }; totalCost: number }) => [
          r.store.id,
          r.totalCost,
        ],
      );
    expect(order(paid)).toEqual(order(plain));
    expect(paid.body.split).toEqual(plain.body.split);
    expect(plain.body.sponsored).toEqual([]);
    expect(paid.body.sponsored).toEqual([
      expect.objectContaining({ label: 'Patrocinado' }),
    ]);
  });

  it('full guest flow without an account: send a receipt, then get a verdict that uses it', async () => {
    const receipt = await request(app.getHttpServer())
      .post('/api/v1/receipts/qr')
      .set('X-Guest-Id', GUEST)
      .send({ url: QR })
      .expect(201);
    expect(receipt.body.pricesAdded).toBe(1); // the milk, matched by barcode
    const res = await verdict({
      radiusKm: 2,
      items: [{ productId: ids.milk, text: 'leite' }],
    }).expect(200);
    const receiptStore = res.body.ranking.find(
      (r: { store: { id: string } }) => r.store.id === receipt.body.store.id,
    );
    expect(receiptStore.lines[0]).toMatchObject({
      unitPrice: 5.49,
      evidence: { source: 'NFCE', receiptCount: 1 },
    });
  });

  it('records anonymous demand once per device, day and area', async () => {
    const body = { items: [{ productId: ids.milk, text: 'leite' }] };
    await verdict(body, '11111111-1111-4111-8111-111111111111').expect(200);
    await verdict(body, '11111111-1111-4111-8111-111111111111').expect(200);
    await verdict(body, '22222222-2222-4222-8222-222222222222').expect(200);
    const rows = await prisma.demandSignal.findMany({
      where: { productId: ids.milk },
    });
    expect(rows.map((r) => r.lists)).toEqual([2]);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'cellKey',
      'day',
      'lists',
      'productId',
    ]); // no ids of people
  });

  it('validates the request', async () => {
    await verdict({ items: [] }).expect(400);
    await verdict({ items: [{ text: 'leite' }], radiusKm: 100 }).expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/verdict')
      .send({ items: [{ text: 'leite' }] })
      .expect(400);
  });
});
