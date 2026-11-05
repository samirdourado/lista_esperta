import { PRODUCT_NORMALIZER } from '../src/integrations/gemini/gemini.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { NormalizationService } from '../src/receipts/normalization.service.js';
import {
  createStore,
  createTestApp,
  resetDatabase,
  signUp,
  signUpAdmin,
  type SignedInAgent,
  type TestApp,
} from './helpers.js';

const normalizer = {
  enabled: true,
  calls: [] as string[][],
  normalize(descriptions: string[]) {
    this.calls.push(descriptions);
    return Promise.resolve([]);
  },
};

describe('Admin catalog moderation (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let admin: SignedInAgent;
  let storeId: string;
  let categoryId: string;

  const product = (canonicalName: string, extra: object = {}) =>
    prisma.product.create({
      data: { canonicalName, categoryId, unit: 'L', unitQuantity: 1, ...extra },
    });

  /** A receipt whose line waited for `aliasId` (as receipts.service stores it). */
  const receiptWith = (aliasId: string, key: string, unitPrice = 5.49) =>
    prisma.receipt.create({
      data: {
        accessKey: key.padEnd(44, '0'),
        storeId,
        issuedAt: new Date(Date.now() - 3600_000),
        total: unitPrice,
        raw: {
          lines: [
            {
              description: 'LT ITAMBE INT 1L',
              unitPrice,
              status: 'PENDING',
              aliasId,
              productId: null,
              productName: 'Leite UHT integral Itambé 1 L',
            },
          ],
        },
      },
    });

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [{ token: PRODUCT_NORMALIZER, value: normalizer }],
    });
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    normalizer.calls = [];
    categoryId = (
      await prisma.category.create({
        data: { slug: 'mercearia', name: 'Mercearia' },
      })
    ).id;
    storeId = await createStore(app);
    admin = await signUpAdmin(app, 'admin@lista.dev');
  });

  afterAll(async () => {
    await app.close();
  });

  it('is for admins only', async () => {
    const shopper = await signUp(app, 'cliente@lista.dev');
    await shopper.agent.get('/api/v1/admin/overview').expect(403);
    await shopper.agent.get('/api/v1/admin/aliases/pending').expect(403);
    await shopper.agent
      .post('/api/v1/admin/products/merge')
      .send({})
      .expect(403);
  });

  it('shows the CNPJ record next to stores waiting for verification', async () => {
    const company = {
      legalName: 'MERCADO DE TESTE LTDA',
      tradeName: null,
      registrationStatus: 'ATIVA',
      address: { city: 'São Paulo', state: 'SP' },
      checks: {
        active: true,
        sameState: true,
        sameCity: true,
        samePostcode: false,
        similarName: false,
      },
    };
    await prisma.store.update({
      where: { id: storeId },
      data: { verificationStatus: 'PENDING', companyData: company },
    });
    const res = await admin.agent
      .get('/api/v1/admin/stores/pending-verification')
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      store: { id: storeId, verificationStatus: 'PENDING' },
      company: {
        legalName: 'MERCADO DE TESTE LTDA',
        checks: { similarName: false },
      },
    });
    await admin.agent
      .post(`/api/v1/admin/stores/${storeId}/verification`)
      .send({ status: 'VERIFIED' })
      .expect(200);
    const after = await admin.agent
      .get('/api/v1/admin/stores/pending-verification')
      .expect(200);
    expect(after.body).toEqual([]);
  });

  it('approving an alias prices past receipts once, and can point it at another product', async () => {
    const suggested = await product('Leite integral 1 L');
    const right = await product('Leite UHT integral Itambé 1 L');
    const alias = await prisma.productAlias.create({
      data: { rawText: 'LT ITAMBE INT 1L', storeId, productId: suggested.id },
    });
    await receiptWith(alias.id, '3526');
    await receiptWith(alias.id, '3527', 5.29);

    const overview = await admin.agent
      .get('/api/v1/admin/overview')
      .expect(200);
    expect(overview.body).toEqual({
      pendingClaims: 0,
      pendingVerifications: 0,
      pendingAliases: 1,
    });
    const pending = await admin.agent
      .get('/api/v1/admin/aliases/pending')
      .expect(200);
    expect(pending.body[0]).toMatchObject({
      occurrences: 2,
      store: { id: storeId },
    });

    const res = await admin.agent
      .post(`/api/v1/admin/aliases/${alias.id}/approve`)
      .send({ productId: right.id })
      .expect(200);
    expect(res.body).toEqual({
      id: alias.id,
      status: 'APPROVED',
      pricesAdded: 2,
    });
    const prices = await prisma.priceObservation.findMany({
      orderBy: { price: 'asc' },
    });
    expect(prices.map((p) => [p.productId, p.source, Number(p.price)])).toEqual(
      [
        [right.id, 'NFCE', 5.29],
        [right.id, 'NFCE', 5.49],
      ],
    );
    const receipt = await prisma.receipt.findFirstOrThrow();
    expect((receipt.raw as { lines: object[] }).lines[0]).toMatchObject({
      status: 'MATCHED',
      productId: right.id,
    });

    await admin.agent
      .post(`/api/v1/admin/aliases/${alias.id}/approve`)
      .send({})
      .expect(409);
  });

  it('a rejected alias never goes back to the model', async () => {
    const suggested = await product('Leite integral 1 L');
    const alias = await prisma.productAlias.create({
      data: { rawText: 'LT ITAMBE INT 1L', storeId, productId: suggested.id },
    });
    await receiptWith(alias.id, '3526');
    await admin.agent
      .post(`/api/v1/admin/aliases/${alias.id}/reject`)
      .expect(200);
    expect(await prisma.priceObservation.count()).toBe(0);

    const [match] = await app.get(NormalizationService).match(
      [
        {
          description: 'lt itambe int 1l',
          code: null,
          quantity: 1,
          unit: 'UN',
          unitPrice: 5,
          totalPrice: 5,
        },
      ],
      storeId,
    );
    expect(match).toMatchObject({ status: 'UNMATCHED', aliasId: alias.id });
    expect(normalizer.calls).toEqual([]);
  });

  it('finds duplicates and merges them, never across sizes or brands', async () => {
    const keep = await product('Leite UHT Integral Itambé 1 L', {
      brand: 'Itambé',
    });
    const dupe = await product('Leite UHT integral Itambe 1 L', {
      gtin: '7896051111153',
    });
    const bigger = await product('Leite UHT Integral Itambé 1 L', {
      unitQuantity: 2,
    });
    const other = await product('Leite UHT Integral Itambé 1 L', {
      brand: 'Piracanjuba',
    });
    await prisma.priceObservation.create({
      data: { storeId, productId: dupe.id, price: 5, source: 'MERCHANT' },
    });
    const shopper = await signUp(app, 'cliente@lista.dev');
    await prisma.priceAlert.create({
      data: {
        userId: shopper.user.id,
        productId: dupe.id,
        targetPrice: 4,
        lat: -23.58,
        lng: -46.63,
      },
    });

    const pairs = await admin.agent
      .get('/api/v1/admin/products/duplicates')
      .expect(200);
    const ids = pairs.body.map((p: { a: { id: string }; b: { id: string } }) =>
      [p.a.id, p.b.id].sort().join(),
    );
    expect(ids).toContain([keep.id, dupe.id].sort().join());
    expect(ids).not.toContain([keep.id, bigger.id].sort().join());
    expect(ids).not.toContain([keep.id, other.id].sort().join());

    const size = await admin.agent
      .post('/api/v1/admin/products/merge')
      .send({ keepId: keep.id, mergeId: bigger.id })
      .expect(409);
    expect(size.body.code).toBe('SIZE_MISMATCH');
    const brand = await admin.agent
      .post('/api/v1/admin/products/merge')
      .send({ keepId: keep.id, mergeId: other.id })
      .expect(409);
    expect(brand.body.code).toBe('BRAND_MISMATCH');

    const merged = await admin.agent
      .post('/api/v1/admin/products/merge')
      .send({ keepId: keep.id, mergeId: dupe.id })
      .expect(200);
    expect(merged.body).toMatchObject({
      pricesMoved: 1,
      product: {
        id: keep.id,
        gtin: '7896051111153',
        brand: 'Itambé',
        prices: 1,
      },
    });
    expect(
      await prisma.product.findUnique({ where: { id: dupe.id } }),
    ).toBeNull();
    expect(
      await prisma.priceAlert.count({ where: { productId: keep.id } }),
    ).toBe(1);
  });
});
