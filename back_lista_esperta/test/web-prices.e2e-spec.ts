import request from 'supertest';
import { ExternalServiceError } from '../src/integrations/http.js';
import {
  GEOCODING_PROVIDER,
  type GeocodedPlace,
} from '../src/integrations/providers.js';
import {
  WEB_SHOPPING,
  type WebShoppingOffer,
} from '../src/integrations/serpapi/serpapi.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, type TestApp } from './helpers.js';

const offer = (
  position: number,
  price: number,
  store: string,
  extra: Partial<WebShoppingOffer> = {},
): WebShoppingOffer => ({
  position,
  title: `Leite UHT Integral ${store} 1L`,
  price,
  store,
  thumbnail: null,
  url: `https://www.google.com/shopping/product/${position}`,
  delivery: null,
  nearby: null,
  ...extra,
});

const shopping = {
  enabled: true,
  fail: null as number | null,
  searches: [] as { query: string; location: string | null }[],
  offers: [] as WebShoppingOffer[],
  search(query: string, location: string | null) {
    this.searches.push({ query, location });
    if (this.fail !== null)
      return Promise.reject(
        new ExternalServiceError('serpapi', this.fail, 'x'),
      );
    return Promise.resolve(this.offers);
  },
  locate(city: string) {
    return Promise.resolve(
      city === 'São Paulo' ? 'Sao Paulo,State of Sao Paulo,Brazil' : null,
    );
  },
};

const geocoding = {
  search: () => Promise.resolve([]),
  reverse: (): Promise<GeocodedPlace> =>
    Promise.resolve({
      label: 'Paraíso, São Paulo',
      lat: -23.58,
      lng: -46.63,
      address: { city: 'São Paulo', state: 'SP' },
    }),
};

describe('Web prices (e2e)', () => {
  let app: TestApp;
  const search = (query: Record<string, string>) =>
    request(app.getHttpServer()).get('/api/v1/web-prices').query(query);

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [
        { token: WEB_SHOPPING, value: shopping },
        { token: GEOCODING_PROVIDER, value: geocoding },
      ],
    });
  });

  beforeEach(async () => {
    await resetDatabase(app);
    shopping.enabled = true;
    shopping.fail = null;
    shopping.searches = [];
    shopping.offers = [
      offer(1, 6.49, 'Pão de Açúcar'),
      offer(2, 4.79, 'Carrefour', { nearby: 'Perto, 2 km' }),
      offer(3, 5.29, 'Atacadão'),
      offer(4, 4.79, 'Carrefour'), // same store and title: shown once
      offer(5, 5.99, 'Dia'),
    ];
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the cheapest offers in the city of the shopper, without an account', async () => {
    const res = await search({
      q: ' leite  integral ',
      lat: '-23.58',
      lng: '-46.63',
    }).expect(200);
    expect(shopping.searches).toEqual([
      {
        query: 'leite integral',
        location: 'Sao Paulo,State of Sao Paulo,Brazil',
      },
    ]);
    expect(res.body).toMatchObject({
      query: 'leite integral',
      location: 'São Paulo',
    });
    expect(
      res.body.offers.map((o: { store: string; price: number }) => [
        o.store,
        o.price,
      ]),
    ).toEqual([
      ['Carrefour', 4.79],
      ['Atacadão', 5.29],
      ['Dia', 5.99],
      ['Pão de Açúcar', 6.49],
    ]);
    expect(res.body.offers[0].nearby).toBe('Perto, 2 km');
  });

  it('keeps every result Google returned, not only the ones shown', async () => {
    await search({
      q: 'leite integral',
      lat: '-23.5812',
      lng: '-46.6303',
    }).expect(200);
    const prisma = app.get(PrismaService);
    const saved = await prisma.webSearch.findFirstOrThrow({
      include: { offers: true },
    });
    expect(saved).toMatchObject({
      query: 'leite integral',
      place: 'Sao Paulo,State of Sao Paulo,Brazil',
      city: 'São Paulo',
      lat: -23.58,
      lng: -46.63,
    });
    expect(saved.offers).toHaveLength(5);
  });

  it('answers repeats from the database, so the monthly quota lasts', async () => {
    await search({ q: 'café 500g', lat: '-23.58', lng: '-46.63' }).expect(200);
    await search({ q: 'Café 500g', lat: '-23.581', lng: '-46.631' }).expect(
      200,
    );
    expect(shopping.searches).toHaveLength(1);
  });

  it('still searches the whole country without a location', async () => {
    const res = await search({ q: 'arroz 5kg' }).expect(200);
    expect(shopping.searches[0].location).toBeNull();
    expect(res.body.location).toBeNull();
  });

  it('explains when the search is off, out of quota or down', async () => {
    shopping.enabled = false;
    expect((await search({ q: 'feijão' }).expect(503)).body.code).toBe(
      'WEB_SEARCH_UNAVAILABLE',
    );
    shopping.enabled = true;
    shopping.fail = 429;
    expect((await search({ q: 'feijão 1kg' }).expect(429)).body.code).toBe(
      'WEB_SEARCH_QUOTA',
    );
    shopping.fail = 500;
    expect((await search({ q: 'feijão preto' }).expect(503)).body.code).toBe(
      'WEB_SEARCH_FAILED',
    );
  });

  it('rejects a query that is too short', async () => {
    await search({ q: 'a' }).expect(400);
  });
});
