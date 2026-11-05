import request from 'supertest';
import { FLYER_SCRAPER } from '../src/integrations/firecrawl/firecrawl.service.js';
import {
  FLYER_READER,
  PRODUCT_NORMALIZER,
} from '../src/integrations/gemini/gemini.service.js';
import type {
  ExtractedFlyerDto,
  NormalizedProductDto,
} from '../src/integrations/gemini/gemini.dto.js';
import { ExternalServiceError } from '../src/integrations/http.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createStore,
  createTestApp,
  resetDatabase,
  signUp,
  signUpAdmin,
  type TestApp,
} from './helpers.js';

const URL = 'https://mercado.example.com/encarte.pdf';
const FLYER_TEXT = `# Ofertas da semana\n\n${'Leite, arroz, banana e café com preço baixo. '.repeat(3)}`;

const scraper = {
  enabled: true,
  down: false,
  markdown: FLYER_TEXT,
  scrape(url: string) {
    if (this.down)
      return Promise.reject(new ExternalServiceError('firecrawl', 500, 'x'));
    return Promise.resolve({ markdown: this.markdown, title: 'Ofertas', url });
  },
};

const reader = {
  enabled: true,
  result: null as ExtractedFlyerDto | null,
  readFlyer() {
    return Promise.resolve(this.result!);
  },
};

/** Banana is ambiguous (0.6): its alias waits for the admin. */
const normalizer = {
  enabled: true,
  calls: [] as string[][],
  normalize(descriptions: string[]): Promise<NormalizedProductDto[]> {
    this.calls.push(descriptions);
    return Promise.resolve(
      descriptions.flatMap((description, index): NormalizedProductDto[] =>
        description.startsWith('Banana')
          ? [
              {
                index,
                canonical_name: 'Banana prata',
                brand: null,
                category_slug: 'mercearia',
                unit: 'kg',
                unit_quantity: 1,
                gtin: null,
                confidence: 0.6,
              },
            ]
          : [],
      ),
    );
  },
};

const inDays = (days: number) =>
  new Date(Date.now() + days * 24 * 3600_000).toISOString().slice(0, 10);

describe('Store flyers (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let owner: request.Agent;
  let storeId: string;
  let milk: string;

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [
        { token: FLYER_SCRAPER, value: scraper },
        { token: FLYER_READER, value: reader },
        { token: PRODUCT_NORMALIZER, value: normalizer },
      ],
    });
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    scraper.down = false;
    scraper.markdown = FLYER_TEXT;
    normalizer.calls = [];
    reader.result = {
      valid_until: inDays(3),
      items: [
        {
          description: 'Leite UHT Integral Itambé 1 L',
          price: 4.79,
          gtin: '7896051111153',
        },
        { description: 'Banana prata kg', price: 5.99, gtin: null },
        { description: 'Produto misterioso', price: 9.9, gtin: null },
      ],
    };
    const category = await prisma.category.create({
      data: { slug: 'mercearia', name: 'Mercearia' },
    });
    milk = (
      await prisma.product.create({
        data: {
          canonicalName: 'Leite UHT integral Itambé 1 L',
          gtin: '7896051111153',
          categoryId: category.id,
          unit: 'L',
          unitQuantity: 1,
        },
      })
    ).id;
    const merchant = await signUp(app, 'dono@loja.dev', 'MERCHANT');
    owner = merchant.agent;
    storeId = await createStore(app, merchant.user.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reads a flyer: confident products get FLYER prices until the end of the offer', async () => {
    const res = await owner
      .post(`/api/v1/stores/${storeId}/flyers`)
      .send({ url: URL })
      .expect(201);
    expect(res.body).toMatchObject({
      status: 'DONE',
      title: 'Ofertas',
      itemsFound: 3,
      pricesAdded: 1,
      pending: 1,
    });
    expect(res.body.items.map((i: { status: string }) => i.status)).toEqual([
      'MATCHED',
      'PENDING',
      'UNMATCHED',
    ]);
    const prices = await prisma.priceObservation.findMany({
      where: { storeId },
    });
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ productId: milk, source: 'FLYER' });
    expect(prices[0].validUntil?.toISOString()).toBe(
      new Date(`${inDays(3)}T23:59:59-03:00`).toISOString(),
    );
    expect(prices[0].flyerId).toBe(res.body.id);

    const list = await owner
      .get(`/api/v1/stores/${storeId}/flyers`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('refuses expired flyers and pages without text, and keeps the failed attempt', async () => {
    reader.result = { ...reader.result!, valid_until: inDays(-2) };
    const expired = await owner
      .post(`/api/v1/stores/${storeId}/flyers`)
      .send({ url: URL })
      .expect(422);
    expect(expired.body.code).toBe('FLYER_EXPIRED');

    scraper.markdown = 'login';
    const empty = await owner
      .post(`/api/v1/stores/${storeId}/flyers`)
      .send({ url: URL })
      .expect(422);
    expect(empty.body.code).toBe('FLYER_EMPTY');

    scraper.down = true;
    const down = await owner
      .post(`/api/v1/stores/${storeId}/flyers`)
      .send({ url: URL })
      .expect(422);
    expect(down.body.code).toBe('FLYER_FETCH_FAILED');

    const list = await owner
      .get(`/api/v1/stores/${storeId}/flyers`)
      .expect(200);
    expect(list.body.map((f: { error: string }) => f.error)).toEqual([
      'FLYER_FETCH_FAILED',
      'FLYER_EMPTY',
      'FLYER_EXPIRED',
    ]);
    expect(await prisma.priceObservation.count()).toBe(0);
  });

  it('lets only members import, and validates the link', async () => {
    const stranger = await signUp(app, 'outro@loja.dev', 'MERCHANT');
    await stranger.agent
      .post(`/api/v1/stores/${storeId}/flyers`)
      .send({ url: URL })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/stores/${storeId}/flyers`)
      .send({ url: URL })
      .expect(401);
    await owner
      .post(`/api/v1/stores/${storeId}/flyers`)
      .send({ url: 'ftp://mercado.example.com/x' })
      .expect(400);
  });

  it('prices the waiting flyer item once the admin approves its product', async () => {
    await owner
      .post(`/api/v1/stores/${storeId}/flyers`)
      .send({ url: URL })
      .expect(201);
    const admin = await signUpAdmin(app, 'admin@lista.dev');
    const pending = await admin.agent
      .get('/api/v1/admin/aliases/pending')
      .expect(200);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0]).toMatchObject({
      rawText: 'BANANA PRATA KG',
      occurrences: 1,
      product: { canonicalName: 'Banana prata', prices: 0 },
    });

    const approved = await admin.agent
      .post(`/api/v1/admin/aliases/${pending.body[0].id}/approve`)
      .send({})
      .expect(200);
    expect(approved.body).toMatchObject({ status: 'APPROVED', pricesAdded: 1 });
    const flyers = await owner
      .get(`/api/v1/stores/${storeId}/flyers`)
      .expect(200);
    expect(flyers.body[0]).toMatchObject({ pricesAdded: 2, pending: 0 });
    expect(
      await prisma.priceObservation.count({ where: { source: 'FLYER' } }),
    ).toBe(2);
  });
});
