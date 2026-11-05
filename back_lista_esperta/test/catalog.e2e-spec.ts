import request from 'supertest';
import { demandCellKey } from '../src/common/demand-cell.js';
import {
  PRODUCT_LOOKUP,
  type ProductSuggestion,
} from '../src/integrations/off/open-food-facts.provider.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StoresGeoRepository } from '../src/stores/stores-geo.repository.js';
import {
  createStore,
  createTestApp,
  resetDatabase,
  signUp,
  type TestApp,
} from './helpers.js';

const OFF_GTIN = '7891000100103';
const offLookup = {
  findByGtin: (gtin: string): Promise<ProductSuggestion | null> =>
    Promise.resolve(
      gtin === OFF_GTIN
        ? {
            gtin,
            name: 'Leite Condensado Integral Moça',
            brand: 'Moça',
            unit: 'G',
            unitQuantity: 395,
            categorySlug: 'laticinios',
            source: 'OPEN_FOOD_FACTS',
          }
        : null,
    ),
};

// A tiny but real 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Merchant catalog and prices (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let rice: string;
  let coffee: string;

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [{ token: PRODUCT_LOOKUP, value: offLookup }],
    });
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const food = await prisma.category.create({
      data: { slug: 'alimentos', name: 'Alimentos' },
    });
    await prisma.category.create({
      data: { slug: 'mercearia', name: 'Mercearia', parentId: food.id },
    });
    await prisma.category.create({
      data: { slug: 'laticinios', name: 'Laticínios', parentId: food.id },
    });
    const mercearia = await prisma.category.findUniqueOrThrow({
      where: { slug: 'mercearia' },
    });
    rice = (
      await prisma.product.create({
        data: {
          gtin: '7896006716112',
          canonicalName: 'Arroz branco 5 kg',
          categoryId: mercearia.id,
          unit: 'KG',
          unitQuantity: 5,
        },
      })
    ).id;
    coffee = (
      await prisma.product.create({
        data: {
          canonicalName: 'Café torrado 500 g',
          categoryId: mercearia.id,
          unit: 'G',
          unitQuantity: 500,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function merchantWithStore(email = 'dona@example.com') {
    const owner = await signUp(app, email, 'MERCHANT');
    const storeId = await createStore(app, owner.user.id);
    return { ...owner, storeId };
  }

  describe('public catalog', () => {
    it('searches by similar name and by barcode, and lists categories', async () => {
      const byName = await request(app.getHttpServer())
        .get('/api/v1/products?q=arroz')
        .expect(200);
      expect(byName.body[0]).toMatchObject({
        canonicalName: 'Arroz branco 5 kg',
        unit: 'KG',
        unitQuantity: 5,
        categorySlug: 'mercearia',
      });
      const byGtin = await request(app.getHttpServer())
        .get('/api/v1/products?gtin=7896006716112')
        .expect(200);
      expect(byGtin.body).toHaveLength(1);
      const tree = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);
      expect(tree.body[0]).toMatchObject({
        slug: 'alimentos',
        children: [{ slug: 'laticinios' }, { slug: 'mercearia' }],
      });
    });
  });

  describe('barcode lookup and product creation (merchant)', () => {
    it('finds catalog products, suggests from Open Food Facts and rejects bad barcodes', async () => {
      const { agent } = await merchantWithStore();
      const local = await agent
        .get('/api/v1/products/lookup/7896006716112')
        .expect(200);
      expect(local.body).toMatchObject({
        product: { id: rice },
        suggestion: null,
      });
      const off = await agent
        .get(`/api/v1/products/lookup/${OFF_GTIN}`)
        .expect(200);
      expect(off.body).toMatchObject({
        product: null,
        suggestion: {
          name: 'Leite Condensado Integral Moça',
          unit: 'G',
          unitQuantity: 395,
        },
      });
      await agent.get('/api/v1/products/lookup/1234567890123').expect(400);
    });

    it('creates a product once per barcode', async () => {
      const { agent } = await merchantWithStore();
      const body = {
        gtin: OFF_GTIN,
        canonicalName: 'Leite condensado 395 g',
        categorySlug: 'laticinios',
        unit: 'G',
        unitQuantity: 395,
      };
      const created = await agent
        .post('/api/v1/products')
        .send(body)
        .expect(201);
      const dup = await agent.post('/api/v1/products').send(body).expect(409);
      expect(dup.body).toMatchObject({
        code: 'GTIN_TAKEN',
        productId: created.body.id,
      });
      await agent
        .post('/api/v1/products')
        .send({ ...body, gtin: undefined, categorySlug: 'nada' })
        .expect(400);
    });
  });

  describe('prices and offers', () => {
    it('sets regular prices and offers in bulk, compares with the region and flags NFC-e divergence', async () => {
      const { agent, storeId } = await merchantWithStore();
      // Two other stores within 5 km price the rice at 20 and 30 → median 25.
      const geo = app.get(StoresGeoRepository);
      for (const [lat, price] of [
        [-23.59, 20],
        [-23.595, 30],
      ] as const) {
        const other = await geo.create({
          name: `Outra ${price}`,
          source: 'OSM',
          lat,
          lng: -46.635,
        });
        await prisma.priceObservation.create({
          data: { productId: rice, storeId: other, price, source: 'COMMUNITY' },
        });
      }
      // A store 50 km away does not count.
      const far = await geo.create({
        name: 'Longe',
        source: 'OSM',
        lat: -24.0,
        lng: -46.6,
      });
      await prisma.priceObservation.create({
        data: { productId: rice, storeId: far, price: 1, source: 'MERCHANT' },
      });

      const nextWeek = new Date(
        Date.now() + 7 * 24 * 3600 * 1000,
      ).toISOString();
      await agent
        .put(`/api/v1/stores/${storeId}/prices`)
        .send({
          prices: [
            { productId: rice, price: 27.9 },
            { productId: coffee, price: 18.5 },
            { productId: coffee, price: 15.99, validUntil: nextWeek },
          ],
        })
        .expect(200, { saved: 3 });
      // A receipt here paid 22 for the rice: 21 % below the shelf price.
      await prisma.priceObservation.create({
        data: { productId: rice, storeId, price: 22, source: 'NFCE' },
      });

      const catalog = await agent
        .get(`/api/v1/stores/${storeId}/products`)
        .expect(200);
      const riceRow = catalog.body.find(
        (row: { productId: string }) => row.productId === rice,
      );
      const coffeeRow = catalog.body.find(
        (row: { productId: string }) => row.productId === coffee,
      );
      expect(riceRow).toMatchObject({
        regularPrice: 27.9,
        regionMedian: 25,
        regionStores: 2,
        receiptPrice: 22,
        divergent: true,
        offerId: null,
      });
      expect(coffeeRow).toMatchObject({
        regularPrice: 18.5,
        offerPrice: 15.99,
        divergent: false,
      });
      expect(coffeeRow.offerValidUntil).toBe(nextWeek);

      const overview = await agent
        .get(`/api/v1/stores/${storeId}/overview`)
        .expect(200);
      expect(overview.body).toMatchObject({
        productsListed: 2,
        activeOffers: 1,
        aboveMedian: 1,
        belowMedian: 0,
      });
      expect(overview.body.divergences).toEqual([
        expect.objectContaining({
          productId: rice,
          merchantPrice: 27.9,
          receiptPrice: 22,
          difference: -0.211,
        }),
      ]);

      // End the offer, then stop selling the rice.
      await agent
        .delete(`/api/v1/stores/${storeId}/offers/${coffeeRow.offerId}`)
        .expect(204);
      await agent
        .delete(`/api/v1/stores/${storeId}/products/${rice}`)
        .expect(204);
      const after = await agent
        .get(`/api/v1/stores/${storeId}/products`)
        .expect(200);
      expect(
        after.body.map((row: { productId: string }) => row.productId),
      ).toEqual([coffee]);
      expect(after.body[0].offerId).toBeNull();
    });

    it('rejects offers in the past or too far ahead, and unknown products', async () => {
      const { agent, storeId } = await merchantWithStore();
      const put = (prices: unknown[]) =>
        agent.put(`/api/v1/stores/${storeId}/prices`).send({ prices });
      await put([
        {
          productId: rice,
          price: 10,
          validUntil: new Date(Date.now() - 1000).toISOString(),
        },
      ]).expect(400);
      await put([
        {
          productId: rice,
          price: 10,
          validUntil: new Date(
            Date.now() + 100 * 24 * 3600 * 1000,
          ).toISOString(),
        },
      ]).expect(400);
      await put([
        { productId: '9b7c1e2d-4a5f-4c3b-8e1d-0f2a3b4c5d6e', price: 10 },
      ]).expect(400);
      await put([{ productId: rice, price: -1 }]).expect(400);
    });

    it('only store members can see or change the catalog', async () => {
      const { storeId } = await merchantWithStore();
      const other = await signUp(app, 'outro@example.com', 'MERCHANT');
      await other.agent.get(`/api/v1/stores/${storeId}/products`).expect(403);
      await other.agent
        .put(`/api/v1/stores/${storeId}/prices`)
        .send({ prices: [{ productId: rice, price: 1 }] })
        .expect(403);
    });
  });

  describe('CSV import', () => {
    it('matches by barcode or name, creates products from Open Food Facts or columns, and reports bad rows', async () => {
      const { agent, storeId } = await merchantWithStore();
      const csv = [
        'codigo;nome;preco;oferta ate;categoria;unidade;quantidade',
        '7896006716112;;27,90;;;;', // known barcode
        `${OFF_GTIN};;8,49;;;;`, // created from Open Food Facts
        ';Café torrado 500 g;R$ 19,90;;;;', // matched by exact name
        ';Feijão preto 1 kg;9,99;;Mercearia;KG;1', // created from columns
        ';Sem preço;;;;;', // MISSING_PRICE
        '123;;5,00;;;;', // INVALID_GTIN
        ';Produto misterioso;5,00;;;;', // PRODUCT_NOT_FOUND
        ';Detergente;3,00;;Limpeza;UN;1', // UNKNOWN_CATEGORY
        ';Café torrado 500 g;15,90;31/12/2001;;;', // INVALID_DATE
      ].join('\r\n');
      const res = await agent
        .post(`/api/v1/stores/${storeId}/prices/import`)
        .attach('file', Buffer.from(csv, 'utf8'), {
          filename: 'precos.csv',
          contentType: 'text/csv',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        rowsRead: 9,
        pricesSaved: 4,
        productsCreated: 2,
      });
      expect(res.body.errors).toEqual([
        { line: 6, code: 'MISSING_PRICE' },
        { line: 7, code: 'INVALID_GTIN' },
        { line: 8, code: 'PRODUCT_NOT_FOUND' },
        { line: 9, code: 'UNKNOWN_CATEGORY' },
        { line: 10, code: 'INVALID_DATE' },
      ]);
      const catalog = await agent
        .get(`/api/v1/stores/${storeId}/products`)
        .expect(200);
      expect(
        catalog.body
          .map((row: { canonicalName: string }) => row.canonicalName)
          .sort(),
      ).toEqual([
        'Arroz branco 5 kg',
        'Café torrado 500 g',
        'Feijão preto 1 kg',
        'Leite Condensado Integral Moça',
      ]);
    });

    it('explains files without the required columns', async () => {
      const { agent, storeId } = await merchantWithStore();
      const res = await agent
        .post(`/api/v1/stores/${storeId}/prices/import`)
        .attach('file', Buffer.from('foo,bar\n1,2'), {
          filename: 'x.csv',
          contentType: 'text/csv',
        })
        .expect(400);
      expect(res.body.code).toBe('MISSING_COLUMNS');
    });
  });

  describe('anonymous demand', () => {
    it('shows products asked for nearby only when at least 10 lists asked', async () => {
      const { agent, storeId } = await merchantWithStore();
      const cell = demandCellKey(-23.5891, -46.6346);
      const today = new Date(new Date().toISOString().slice(0, 10));
      await prisma.demandSignal.createMany({
        data: [
          { productId: rice, cellKey: cell, day: today, lists: 12 },
          { productId: coffee, cellKey: cell, day: today, lists: 4 },
        ],
      });
      const res = await agent
        .get(`/api/v1/stores/${storeId}/overview`)
        .expect(200);
      expect(res.body.demand).toEqual([
        {
          productId: rice,
          canonicalName: 'Arroz branco 5 kg',
          lists: 12,
          listed: false,
        },
      ]);
    });
  });

  describe('team and photos', () => {
    it('owner adds staff; staff edits prices but cannot manage the team; the last owner stays', async () => {
      const owner = await merchantWithStore();
      const staff = await signUp(app, 'equipe@example.com', 'MERCHANT');
      await signUp(app, 'cliente@example.com', 'SHOPPER');

      await owner.agent
        .post(`/api/v1/stores/${owner.storeId}/members`)
        .send({ email: 'cliente@example.com' })
        .expect(404);
      await owner.agent
        .post(`/api/v1/stores/${owner.storeId}/members`)
        .send({ email: 'EQUIPE@example.com' })
        .expect(204);
      await owner.agent
        .post(`/api/v1/stores/${owner.storeId}/members`)
        .send({ email: 'equipe@example.com' })
        .expect(409);

      await staff.agent
        .put(`/api/v1/stores/${owner.storeId}/prices`)
        .send({ prices: [{ productId: rice, price: 26 }] })
        .expect(200);
      await staff.agent
        .post(`/api/v1/stores/${owner.storeId}/members`)
        .send({ email: 'dona@example.com' })
        .expect(403);

      const last = await owner.agent
        .delete(`/api/v1/stores/${owner.storeId}/members/${owner.user.id}`)
        .expect(409);
      expect(last.body.code).toBe('LAST_OWNER');
      await owner.agent
        .delete(`/api/v1/stores/${owner.storeId}/members/${staff.user.id}`)
        .expect(204);
    });

    it('uploads, serves, lists and deletes store photos; refuses non-images', async () => {
      const { agent, storeId } = await merchantWithStore();
      await agent
        .post(`/api/v1/stores/${storeId}/photos`)
        .attach('file', Buffer.from('not an image at all'), {
          filename: 'x.png',
          contentType: 'image/png',
        })
        .expect(400);
      const uploaded = await agent
        .post(`/api/v1/stores/${storeId}/photos`)
        .attach('file', PNG, {
          filename: 'fachada.png',
          contentType: 'image/png',
        })
        .expect(201);
      const path = new URL(uploaded.body.url as string).pathname;
      expect(path).toMatch(/^\/uploads\/stores\/.+\.png$/);
      const served = await request(app.getHttpServer()).get(path).expect(200);
      expect(served.headers['x-content-type-options']).toBe('nosniff');

      const list = await request(app.getHttpServer())
        .get(`/api/v1/stores/${storeId}/photos`)
        .expect(200);
      expect(list.body).toHaveLength(1);
      await agent
        .delete(`/api/v1/stores/${storeId}/photos/${uploaded.body.id}`)
        .expect(204);
      await request(app.getHttpServer()).get(path).expect(404);
    });
  });
});
