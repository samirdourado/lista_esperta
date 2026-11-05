import './enable-discovery.js';
import request from 'supertest';
import type { Cell } from '../src/common/geo-cell.js';
import { ExternalServiceError } from '../src/integrations/http.js';
import {
  CNPJ_LOOKUP,
  GEOCODING_PROVIDER,
  PLACES_PROVIDER,
  type CompanyRecord,
  type GeocodedPlace,
} from '../src/integrations/providers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DiscoveryService } from '../src/stores/discovery.service.js';
import type { PlaceCandidate } from '../src/stores/store.types.js';
import {
  createStore,
  createTestApp,
  resetDatabase,
  signUp,
  signUpAdmin,
  type TestApp,
} from './helpers.js';

// Vila Mariana, São Paulo
const HERE = { lat: -23.5891, lng: -46.6346 };
const SP = { city: 'São Paulo', state: 'SP', postcode: '04036-000' };

const OSM_MARKET: PlaceCandidate = {
  externalId: 'node/1001',
  name: 'Mercado do Mapa',
  lat: -23.5895,
  lng: -46.635,
  address: { street: 'Rua Vergueiro', ...SP },
  openingHours: { osm: 'Mo-Sa 08:00-21:00' },
  categorySlugs: ['alimentos'],
};
const OSM_PHARMACY: PlaceCandidate = {
  externalId: 'way/2002',
  name: 'Drogaria Bairro',
  lat: -23.6,
  lng: -46.64,
  address: SP,
  categorySlugs: ['farmacia'],
};

/** Fakes for the free external services: no network in tests. */
const places = {
  source: 'OSM' as const,
  calls: [] as Cell[],
  result: [] as PlaceCandidate[],
  fetchArea(cell: Cell) {
    this.calls.push(cell);
    // Return each candidate only from the cell that contains it.
    return Promise.resolve(
      this.result.filter(
        (p) =>
          p.lat >= cell.south &&
          p.lat < cell.north &&
          p.lng >= cell.west &&
          p.lng < cell.east,
      ),
    );
  },
};

const companies = new Map<string, CompanyRecord>([
  [
    '11222333000181',
    {
      cnpj: '11222333000181',
      legalName: 'BOM PRECO SUPERMERCADOS LTDA',
      tradeName: 'MERCADO BOM PRECO',
      registrationStatus: 'ATIVA',
      address: { city: 'SAO PAULO', state: 'SP', postcode: '04036000' },
    },
  ],
  [
    '11444777000161',
    {
      cnpj: '11444777000161',
      legalName: 'MERCADO DO MAPA COMERCIO LTDA',
      tradeName: null,
      registrationStatus: 'ATIVA',
      address: { city: 'SAO PAULO', state: 'SP', postcode: '04010000' },
    },
  ],
  [
    '00000000000191',
    {
      cnpj: '00000000000191',
      legalName: 'EMPRESA FECHADA SA',
      tradeName: null,
      registrationStatus: 'BAIXADA',
      address: { city: 'BRASILIA', state: 'DF' },
    },
  ],
]);
const cnpjLookup = {
  find: (cnpj: string) => Promise.resolve(companies.get(cnpj) ?? null),
};

const geocoding = {
  mode: 'ok' as 'ok' | 'down',
  search(query: string): Promise<GeocodedPlace[]> {
    if (this.mode === 'down')
      return Promise.reject(new ExternalServiceError('nominatim', 503, 'down'));
    return Promise.resolve([
      { label: `${query}, São Paulo`, ...HERE, address: SP },
    ]);
  },
  reverse(): Promise<GeocodedPlace | null> {
    return Promise.resolve(null);
  },
};

describe('Stores (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [
        { token: PLACES_PROVIDER, value: places },
        { token: CNPJ_LOOKUP, value: cnpjLookup },
        { token: GEOCODING_PROVIDER, value: geocoding },
      ],
    });
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    await prisma.category.createMany({
      data: [
        { slug: 'alimentos', name: 'Alimentos' },
        { slug: 'farmacia', name: 'Farmácia' },
        { slug: 'limpeza', name: 'Limpeza' },
      ],
    });
    places.calls = [];
    places.result = [OSM_MARKET, OSM_PHARMACY];
    geocoding.mode = 'ok';
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const nearby = (query = '') =>
    request(server()).get(
      `/api/v1/stores/nearby?lat=${HERE.lat}&lng=${HERE.lng}${query}`,
    );

  describe('GET /stores/nearby (public)', () => {
    it('answers at once, imports shops in the background, then lists them closest first', async () => {
      const first = await nearby().expect(200);
      expect(first.body.pendingAreas).toBeGreaterThan(0);

      await app.get(DiscoveryService).drain();
      const second = await nearby().expect(200);
      expect(second.body.pendingAreas).toBe(0);
      expect(second.body.stores.map((s: { name: string }) => s.name)).toEqual([
        'Mercado do Mapa',
        'Drogaria Bairro',
      ]);
      expect(second.body.stores[0]).toMatchObject({
        source: 'OSM',
        verificationStatus: 'UNVERIFIED',
        categories: ['alimentos'],
        managed: false,
        openingHours: { osm: 'Mo-Sa 08:00-21:00' },
      });
      expect(second.body.stores[0].distanceKm).toBeLessThan(0.1);

      // Cached: a new request does not hit OpenStreetMap again.
      const calls = places.calls.length;
      await nearby().expect(200);
      expect(places.calls.length).toBe(calls);
    });

    it('respects the radius', async () => {
      await nearby().expect(200);
      await app.get(DiscoveryService).drain();
      const close = await nearby('&radiusKm=0.5').expect(200);
      expect(close.body.stores.map((s: { name: string }) => s.name)).toEqual([
        'Mercado do Mapa',
      ]);
    });

    it('does not duplicate a store a merchant already registered at the same spot', async () => {
      const owner = await signUp(app, 'dona@example.com', 'MERCHANT');
      await owner.agent
        .post('/api/v1/stores')
        .send({
          name: 'Mercado do Mapa',
          lat: -23.58952,
          lng: -46.63502,
          address: SP,
        })
        .expect(201);
      await nearby().expect(200);
      await app.get(DiscoveryService).drain();
      const res = await nearby().expect(200);
      const markets = res.body.stores.filter(
        (s: { name: string }) => s.name === 'Mercado do Mapa',
      );
      expect(markets).toHaveLength(1);
      expect(markets[0].source).toBe('MERCHANT_REGISTERED');
    });

    it('validates coordinates and radius', async () => {
      await request(server())
        .get('/api/v1/stores/nearby?lat=200&lng=0')
        .expect(400);
      await nearby('&radiusKm=50').expect(400);
    });
  });

  describe('merchant registers a store', () => {
    it('creates it with the merchant as owner, and /auth/me lists it', async () => {
      const { agent } = await signUp(app, 'dona@example.com', 'MERCHANT');
      const res = await agent
        .post('/api/v1/stores')
        .send({
          name: 'Mercearia Nova',
          lat: HERE.lat,
          lng: HERE.lng,
          address: { street: 'Rua A', number: '10', ...SP },
          openingHours: {
            weekly: { mon: [{ open: '08:00', close: '18:00' }] },
          },
          categorySlugs: ['alimentos', 'limpeza'],
        })
        .expect(201);
      expect(res.body.store).toMatchObject({
        name: 'Mercearia Nova',
        source: 'MERCHANT_REGISTERED',
        verificationStatus: 'UNVERIFIED',
        categories: ['alimentos', 'limpeza'],
        managed: true,
        openingHours: { weekly: { mon: [{ open: '08:00', close: '18:00' }] } },
      });
      expect(res.body.store.lat).toBeCloseTo(HERE.lat, 5);

      const me = await agent.get('/api/v1/auth/me').expect(200);
      expect(me.body.storeIds).toEqual([res.body.store.id]);
      const mine = await agent.get('/api/v1/stores/mine').expect(200);
      expect(mine.body[0]).toMatchObject({
        id: res.body.store.id,
        memberRole: 'OWNER',
      });
    });

    it('verifies the CNPJ against the registry when it matches the address', async () => {
      const { agent } = await signUp(app, 'dona@example.com', 'MERCHANT');
      const res = await agent
        .post('/api/v1/stores')
        .send({
          name: 'Mercado Bom Preço',
          cnpj: '11.222.333/0001-81',
          ...HERE,
          address: SP,
        })
        .expect(201);
      expect(res.body.verification).toMatchObject({
        status: 'VERIFIED',
        legalName: 'BOM PRECO SUPERMERCADOS LTDA',
      });
      expect(res.body.store).toMatchObject({
        cnpj: '11222333000181',
        verificationStatus: 'VERIFIED',
      });
    });

    it('keeps the store but reports why an inactive CNPJ was not accepted', async () => {
      const { agent } = await signUp(app, 'dona@example.com', 'MERCHANT');
      const res = await agent
        .post('/api/v1/stores')
        .send({
          name: 'Loja Fechada',
          cnpj: '00000000000191',
          ...HERE,
          address: SP,
        })
        .expect(201);
      expect(res.body.verification).toBeNull();
      expect(res.body.verificationError).toBe('CNPJ_NOT_ACTIVE');
      expect(res.body.store.verificationStatus).toBe('UNVERIFIED');
    });

    it('refuses an invalid CNPJ and a CNPJ already used by another store', async () => {
      const { agent } = await signUp(app, 'dona@example.com', 'MERCHANT');
      await agent
        .post('/api/v1/stores')
        .send({ name: 'Loja X', cnpj: '11222333000182', ...HERE, address: SP })
        .expect(400);
      await agent
        .post('/api/v1/stores')
        .send({
          name: 'Mercado Bom Preço',
          cnpj: '11222333000181',
          ...HERE,
          address: SP,
        })
        .expect(201);
      const taken = await agent
        .post('/api/v1/stores')
        .send({
          name: 'Outra',
          cnpj: '11222333000181',
          lat: -23.6,
          lng: -46.7,
          address: SP,
        })
        .expect(409);
      expect(taken.body.code).toBe('CNPJ_TAKEN');
    });

    it('points to the existing store when it looks like a duplicate, unless the merchant confirms', async () => {
      const { agent } = await signUp(app, 'dona@example.com', 'MERCHANT');
      const existing = await createStore(app);
      const body = {
        name: 'Loja de Teste',
        lat: -23.58912,
        lng: -46.63462,
        address: SP,
      };
      const dup = await agent.post('/api/v1/stores').send(body).expect(409);
      expect(dup.body).toMatchObject({
        code: 'POSSIBLE_DUPLICATE',
        storeId: existing,
      });
      await agent
        .post('/api/v1/stores')
        .send({ ...body, confirmNotDuplicate: true })
        .expect(201);
    });

    it('is only for merchants and rejects unknown categories', async () => {
      const shopper = await signUp(app, 'cliente@example.com');
      await shopper.agent
        .post('/api/v1/stores')
        .send({ name: 'X', ...HERE, address: SP })
        .expect(403);
      const merchant = await signUp(app, 'dona@example.com', 'MERCHANT');
      const res = await merchant.agent
        .post('/api/v1/stores')
        .send({
          name: 'Loja Y',
          ...HERE,
          address: SP,
          categorySlugs: ['inexistente'],
        })
        .expect(400);
      expect(res.body.code).toBe('UNKNOWN_CATEGORY');
    });
  });

  describe('editing and verifying a store', () => {
    it('lets the owner move the pin and change categories; others get 403', async () => {
      const owner = await signUp(app, 'dona@example.com', 'MERCHANT');
      const other = await signUp(app, 'outro@example.com', 'MERCHANT');
      const storeId = await createStore(app, owner.user.id);

      await other.agent
        .patch(`/api/v1/stores/${storeId}`)
        .send({ name: 'Hack' })
        .expect(403);
      const res = await owner.agent
        .patch(`/api/v1/stores/${storeId}`)
        .send({ lat: -23.6, lng: -46.65, categorySlugs: ['farmacia'] })
        .expect(200);
      expect(res.body).toMatchObject({ categories: ['farmacia'] });
      expect(res.body.lat).toBeCloseTo(-23.6, 5);
      await owner.agent
        .patch(`/api/v1/stores/${storeId}`)
        .send({ lat: -23.6 })
        .expect(400);
    });

    it('only the owner can verify the CNPJ, not staff', async () => {
      const owner = await signUp(app, 'dona@example.com', 'MERCHANT');
      const staff = await signUp(app, 'equipe@example.com', 'MERCHANT');
      const storeId = await createStore(app, owner.user.id);
      await prisma.store.update({
        where: { id: storeId },
        data: { address: SP },
      });
      await prisma.storeMember.create({
        data: { storeId, userId: staff.user.id, memberRole: 'STAFF' },
      });

      await staff.agent
        .post(`/api/v1/stores/${storeId}/verification`)
        .send({ cnpj: '11222333000181' })
        .expect(403);
      const res = await owner.agent
        .post(`/api/v1/stores/${storeId}/verification`)
        .send({ cnpj: '11222333000181' })
        .expect(200);
      expect(res.body.status).toBe('VERIFIED');
      await owner.agent
        .post(`/api/v1/stores/${storeId}/verification`)
        .send({ cnpj: '11222333000100' })
        .expect(400);
    });
  });

  describe('claims', () => {
    async function osmStore() {
      await nearby().expect(200);
      await app.get(DiscoveryService).drain();
      const store = await prisma.store.findFirstOrThrow({
        where: { externalId: OSM_MARKET.externalId },
      });
      return store.id;
    }

    it('approves at once when the CNPJ matches the store from the map', async () => {
      const storeId = await osmStore();
      const { agent, user } = await signUp(app, 'dona@example.com', 'MERCHANT');
      const res = await agent
        .post('/api/v1/store-claims')
        .send({ storeId, cnpj: '11444777000161' })
        .expect(201);
      expect(res.body).toMatchObject({
        autoApproved: true,
        claim: { status: 'APPROVED' },
      });
      expect(res.body.claim.store).toMatchObject({
        verificationStatus: 'VERIFIED',
        managed: true,
      });
      const member = await prisma.storeMember.findUnique({
        where: { storeId_userId: { storeId, userId: user.id } },
      });
      expect(member?.memberRole).toBe('OWNER');
      await agent.post('/api/v1/store-claims').send({ storeId }).expect(409);
    });

    it('waits for an admin without a CNPJ, and the admin decides once', async () => {
      const storeId = await osmStore();
      const merchant = await signUp(app, 'dona@example.com', 'MERCHANT');
      const admin = await signUpAdmin(app, 'admin@example.com');

      const claim = await merchant.agent
        .post('/api/v1/store-claims')
        .send({ storeId, message: 'Sou a dona' })
        .expect(201);
      expect(claim.body).toMatchObject({
        autoApproved: false,
        claim: { status: 'PENDING', message: 'Sou a dona' },
      });
      // Asking again returns the same pending claim.
      const again = await merchant.agent
        .post('/api/v1/store-claims')
        .send({ storeId })
        .expect(201);
      expect(again.body.claim.id).toBe(claim.body.claim.id);

      const claimId = claim.body.claim.id as string;
      await merchant.agent
        .post(`/api/v1/admin/store-claims/${claimId}/approve`)
        .expect(403);
      const pending = await admin.agent
        .get('/api/v1/admin/store-claims')
        .expect(200);
      expect(pending.body).toHaveLength(1);
      expect(pending.body[0].user.email).toBe('dona@example.com');

      await admin.agent
        .post(`/api/v1/admin/store-claims/${claimId}/approve`)
        .expect(200);
      await admin.agent
        .post(`/api/v1/admin/store-claims/${claimId}/reject`)
        .expect(409);
      const mine = await merchant.agent.get('/api/v1/stores/mine').expect(200);
      expect(mine.body.map((s: { id: string }) => s.id)).toEqual([storeId]);
    });
  });

  describe('geocoding (public)', () => {
    it('searches addresses and explains when the service is down', async () => {
      const res = await request(server())
        .get('/api/v1/geocoding/search?q=Rua%20Vergueiro')
        .expect(200);
      expect(res.body[0]).toMatchObject({ address: { state: 'SP' } });
      await request(server()).get('/api/v1/geocoding/search?q=ab').expect(400);
      await request(server())
        .get(`/api/v1/geocoding/reverse?lat=${HERE.lat}&lng=${HERE.lng}`)
        .expect(404);
      geocoding.mode = 'down';
      await request(server())
        .get('/api/v1/geocoding/search?q=Rua%20Vergueiro')
        .expect(503);
    });
  });
});
