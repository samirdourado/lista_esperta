import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { ExternalServiceError } from '../src/integrations/http.js';
import {
  PRODUCT_NORMALIZER,
  RECEIPT_READER,
} from '../src/integrations/gemini/gemini.service.js';
import type { NormalizedProductDto } from '../src/integrations/gemini/gemini.dto.js';
import { GEOCODING_PROVIDER } from '../src/integrations/providers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { accessKeyCheckDigit } from '../src/receipts/access-key.js';
import { SEFAZ_FETCHER } from '../src/receipts/sefaz-fetcher.js';
import { StoresGeoRepository } from '../src/stores/stores-geo.repository.js';
import {
  createTestApp,
  resetDatabase,
  signUp,
  type TestApp,
} from './helpers.js';

const KEY = '35261111222333000181650010000123451123456780';
const qr = (key = KEY, host = 'www.nfce.fazenda.sp.gov.br') =>
  `https://${host}/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${key}|2|1|1|0123456789ABCDEF`;
/** Another valid SP key (different number) for a second receipt. */
const KEY_2 = (() => {
  const base = `${KEY.slice(0, 25)}000012346${KEY.slice(34, 43)}`;
  return base + accessKeyCheckDigit(base);
})();
const GUEST = '0b7f4a2c-9d1e-4f3a-8b6c-5d4e3f2a1b0c';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const sefaz = {
  pages: 0,
  html: readFileSync(
    join(process.cwd(), 'test/fixtures/nfce/sp-consulta-qrcode.html'),
    'utf8',
  ),
  down: false,
  fetchPage() {
    this.pages += 1;
    if (this.down)
      return Promise.reject(new ExternalServiceError('sefaz', 503, 'down'));
    return Promise.resolve(this.html);
  },
};

/** Fake Gemini: rice is clear (0.95), banana is ambiguous (0.6). */
const normalizer = {
  enabled: true,
  calls: [] as string[][],
  normalize(descriptions: string[]): Promise<NormalizedProductDto[]> {
    this.calls.push(descriptions);
    return Promise.resolve(
      descriptions.flatMap((description, index): NormalizedProductDto[] => {
        if (description.startsWith('ARROZ')) {
          return [
            {
              index,
              canonical_name: 'Arroz branco tipo 1 Camil 5 kg',
              brand: 'Camil',
              category_slug: 'mercearia',
              unit: 'kg',
              unit_quantity: 5,
              gtin: null,
              confidence: 0.95,
            },
          ];
        }
        if (description.startsWith('BANANA')) {
          return [
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
          ];
        }
        return [];
      }),
    );
  },
};

const reader = {
  enabled: true,
  result: null as unknown,
  read() {
    return Promise.resolve(this.result);
  },
};

const geocoding = {
  search: () =>
    Promise.resolve([
      {
        label: 'Rua Domingos de Morais, 2000',
        lat: -23.5937,
        lng: -46.637,
        address: { city: 'São Paulo', state: 'SP' },
      },
    ]),
  reverse: () => Promise.resolve(null),
};

describe('Receipts / NFC-e (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [
        { token: SEFAZ_FETCHER, value: sefaz },
        { token: PRODUCT_NORMALIZER, value: normalizer },
        { token: RECEIPT_READER, value: reader },
        { token: GEOCODING_PROVIDER, value: geocoding },
      ],
    });
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const food = await prisma.category.create({
      data: { slug: 'alimentos', name: 'Alimentos' },
    });
    const mercearia = await prisma.category.create({
      data: { slug: 'mercearia', name: 'Mercearia', parentId: food.id },
    });
    await prisma.product.create({
      data: {
        gtin: '7896051111153',
        canonicalName: 'Leite UHT integral Itambé 1 L',
        categoryId: mercearia.id,
        unit: 'L',
        unitQuantity: 1,
      },
    });
    sefaz.pages = 0;
    sefaz.down = false;
    normalizer.calls = [];
    reader.enabled = true;
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (path: string) =>
    request(app.getHttpServer()).post(`/api/v1/receipts/${path}`);

  it('a guest imports a receipt by QR code: store from CNPJ, prices for matched lines, ambiguous lines pending', async () => {
    const res = await post('qr')
      .set('X-Guest-Id', GUEST)
      .send({ url: qr() })
      .expect(201);
    expect(res.body).toMatchObject({
      accessKey: KEY,
      store: { name: 'BOM PRECO SUPERMERCADOS LTDA' },
      total: 46.51,
      pricesAdded: 2,
      source: 'SEFAZ',
      issuedAt: '2026-11-03T21:42:10.000Z',
    });
    expect(
      res.body.lines.map(
        (l: { status: string; productName: string | null }) => [
          l.status,
          l.productName,
        ],
      ),
    ).toEqual([
      ['MATCHED', 'Leite UHT integral Itambé 1 L'], // by barcode
      ['MATCHED', 'Arroz branco tipo 1 Camil 5 kg'], // by Gemini, confident
      ['PENDING', 'Banana prata'], // by Gemini, below 0.8: waits for an admin
    ]);
    // Only the unknown lines went to the model.
    expect(normalizer.calls).toEqual([
      ['ARROZ TP1 CAMIL 5KG', 'BANANA PRATA KG'],
    ]);

    const store = await prisma.store.findUniqueOrThrow({
      where: { cnpj: '11222333000181' },
    });
    expect(store.source).toBe('NFCE');
    const prices = await prisma.priceObservation.findMany({
      where: { storeId: store.id },
      orderBy: { price: 'asc' },
    });
    expect(
      prices.map((p) => [p.source, p.price.toNumber(), p.guestId]),
    ).toEqual([
      ['NFCE', 5.49, GUEST],
      ['NFCE', 26.9, GUEST],
    ]);
    const aliases = await prisma.productAlias.findMany({
      orderBy: { rawText: 'asc' },
    });
    expect(aliases.map((a) => [a.rawText, a.status])).toEqual([
      ['ARROZ TP1 CAMIL 5KG', 'APPROVED'],
      ['BANANA PRATA KG', 'PENDING'],
    ]);

    // The same receipt never counts twice.
    const again = await post('qr')
      .set('X-Guest-Id', GUEST)
      .send({ url: qr() })
      .expect(409);
    expect(again.body.code).toBe('RECEIPT_ALREADY_SENT');
    expect(sefaz.pages).toBe(1);
  });

  it('reuses learned aliases on the next receipt of the same store', async () => {
    await post('qr').send({ url: qr() }).expect(201);
    normalizer.calls = [];
    const res = await post('qr')
      .send({ url: qr(KEY_2) })
      .expect(201);
    expect(res.body.pricesAdded).toBe(2);
    expect(normalizer.calls).toEqual([]);
  });

  it('gives the CNPJ to the same shop already on the map instead of duplicating it', async () => {
    const osm = await app.get(StoresGeoRepository).create({
      name: 'Bom Preço Supermercados',
      source: 'OSM',
      externalId: 'node/9',
      lat: -23.5938,
      lng: -46.6371,
    });
    const res = await post('qr').send({ url: qr() }).expect(201);
    expect(res.body.store.id).toBe(osm);
    expect(
      (await prisma.store.findUniqueOrThrow({ where: { id: osm } })).cnpj,
    ).toBe('11222333000181');
  });

  it('does not take a different shop nearby that is only also a "supermercado"', async () => {
    const other = await app.get(StoresGeoRepository).create({
      name: 'Pastorinho Supermercados',
      source: 'OSM',
      externalId: 'node/10',
      lat: -23.5938,
      lng: -46.6371,
    });
    const res = await post('qr').send({ url: qr() }).expect(201);
    expect(res.body.store.id).not.toBe(other);
    expect(
      (await prisma.store.findUniqueOrThrow({ where: { id: other } })).cnpj,
    ).toBeNull();
  });

  it('never merges products of different brands', async () => {
    const mercearia = await prisma.category.findUniqueOrThrow({
      where: { slug: 'mercearia' },
    });
    const other = await prisma.product.create({
      data: {
        canonicalName: 'Arroz branco tipo 1 Camil 5 kg',
        brand: 'Tio João',
        categoryId: mercearia.id,
        unit: 'KG',
        unitQuantity: 5,
      },
    });
    await post('qr').send({ url: qr() }).expect(201);
    const alias = await prisma.productAlias.findFirstOrThrow({
      where: { rawText: 'ARROZ TP1 CAMIL 5KG' },
    });
    expect(alias.productId).not.toBe(other.id);
  });

  it('only fetches allow-listed SEFAZ hosts and supported states', async () => {
    const evil = await post('qr')
      .send({ url: qr(KEY, 'evil.example.com') })
      .expect(422);
    expect(evil.body.code).toBe('NOT_A_RECEIPT_QR');
    await post('qr').send({ url: 'not a url at all, just text' }).expect(422);
    const rjBase = `33${KEY.slice(2, 43)}`;
    const rj = await post('qr')
      .send({
        url: qr(rjBase + accessKeyCheckDigit(rjBase), 'www4.fazenda.rj.gov.br'),
      })
      .expect(422);
    expect(rj.body.code).toBe('UF_NOT_SUPPORTED');
    expect(sefaz.pages).toBe(0);
  });

  it('explains when the SEFAZ is down', async () => {
    sefaz.down = true;
    const res = await post('qr').send({ url: qr() }).expect(503);
    expect(res.body.code).toBe('SEFAZ_UNAVAILABLE');
  });

  it('validates a typed access key and says whether it was already sent', async () => {
    const info = await post('key').send({ accessKey: KEY }).expect(200);
    expect(info.body).toMatchObject({
      valid: true,
      uf: 'SP',
      cnpj: '11222333000181',
      month: '2026-11',
      supported: true,
      alreadySent: false,
    });
    const wrong = await post('key')
      .send({ accessKey: `${KEY.slice(0, 43)}1` })
      .expect(200);
    expect(wrong.body).toMatchObject({ valid: false, error: 'CHECK_DIGIT' });
    await post('qr').send({ url: qr() }).expect(201);
    expect(
      (await post('key').send({ accessKey: KEY }).expect(200)).body.alreadySent,
    ).toBe(true);
  });

  it('reads a receipt photo with the model, requiring a valid access key', async () => {
    reader.result = {
      access_key: KEY_2,
      store_name: 'BOM PRECO SUPERMERCADOS LTDA',
      cnpj: '11.222.333/0001-81',
      address: 'RUA DOMINGOS DE MORAIS, 2000, , VILA MARIANA, SAO PAULO, SP',
      issued_at: '2026-11-04T10:00:00-03:00',
      total: 10.98,
      lines: [
        {
          description: 'LT LEITE ITAMBE INT 1L',
          code: '7896051111153',
          quantity: 2,
          unit: 'un',
          unit_price: 5.49,
          total_price: 10.98,
        },
      ],
    };
    const res = await post('photo')
      .attach('file', PNG, { filename: 'nota.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body).toMatchObject({
      source: 'PHOTO',
      pricesAdded: 1,
      accessKey: KEY_2,
    });

    reader.result = { ...(reader.result as object), access_key: null };
    const noKey = await post('photo')
      .attach('file', PNG, { filename: 'nota.png', contentType: 'image/png' })
      .expect(422);
    expect(noKey.body.code).toBe('PHOTO_KEY_UNREADABLE');
    await post('photo')
      .attach('file', Buffer.from('texto'), {
        filename: 'nota.png',
        contentType: 'image/png',
      })
      .expect(400);

    reader.enabled = false;
    const off = await post('photo')
      .attach('file', PNG, { filename: 'nota.png', contentType: 'image/png' })
      .expect(503);
    expect(off.body.code).toBe('PHOTO_UNAVAILABLE');
  });

  it('signed-in uploads belong to the account and are listed', async () => {
    const { agent, user } = await signUp(app, 'ana@example.com');
    await agent
      .post('/api/v1/receipts/qr')
      .set('X-Guest-Id', GUEST)
      .send({ url: qr() })
      .expect(201);
    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { accessKey: KEY },
    });
    expect(receipt).toMatchObject({ uploadedById: user.id, guestId: null });
    const mine = await agent.get('/api/v1/receipts/mine').expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ accessKey: KEY, pricesAdded: 2 });
    await request(app.getHttpServer()).get('/api/v1/receipts/mine').expect(401);
  });

  it('accepts community prices from guests with a device id', async () => {
    const store = await app
      .get(StoresGeoRepository)
      .create({ name: 'Loja', source: 'OSM', lat: -23.59, lng: -46.63 });
    const product = await prisma.product.findFirstOrThrow();
    const body = { storeId: store, productId: product.id, price: 6.49 };
    await request(app.getHttpServer())
      .post('/api/v1/prices/community')
      .send(body)
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/prices/community')
      .set('X-Guest-Id', GUEST)
      .send(body)
      .expect(201);
    const saved = await prisma.priceObservation.findFirstOrThrow({
      where: { source: 'COMMUNITY' },
    });
    expect(saved).toMatchObject({ guestId: GUEST, reportedById: null });
  });
});
