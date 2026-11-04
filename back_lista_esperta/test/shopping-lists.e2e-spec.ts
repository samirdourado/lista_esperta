import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createStore,
  createTestApp,
  resetDatabase,
  signUp,
  type TestApp,
} from './helpers.js';

const GUEST = '9b7c1e2d-4a5f-4c3b-8e1d-0f2a3b4c5d6e';
const LIST = {
  name: 'Compras da semana',
  items: [
    { freeText: 'arroz 5kg' },
    { freeText: 'leite integral', quantity: 2 },
  ],
};

describe('Shopping lists (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is only available to signed-in users (guests keep lists on the device)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/shopping-lists')
      .expect(401);
  });

  it('creates, reads, replaces and deletes the owner’s list, keeping item order', async () => {
    const { agent } = await signUp(app, 'ana@example.com');
    const created = await agent
      .post('/api/v1/shopping-lists')
      .send(LIST)
      .expect(201);
    expect(
      created.body.items.map((i: { freeText: string }) => i.freeText),
    ).toEqual(['arroz 5kg', 'leite integral']);
    expect(created.body.items[1].quantity).toBe(2);

    const id = created.body.id as string;
    const replaced = await agent
      .put(`/api/v1/shopping-lists/${id}`)
      .send({ name: 'Mercado', items: [{ freeText: 'café' }] })
      .expect(200);
    expect(replaced.body).toMatchObject({
      name: 'Mercado',
      items: [{ freeText: 'café', quantity: 1 }],
    });

    await agent.delete(`/api/v1/shopping-lists/${id}`).expect(204);
    await agent.get(`/api/v1/shopping-lists/${id}`).expect(404);
  });

  it('hides other people’s lists: read, update and delete all answer 404', async () => {
    const ana = await signUp(app, 'ana@example.com');
    const bia = await signUp(app, 'bia@example.com');
    const created = await ana.agent
      .post('/api/v1/shopping-lists')
      .send(LIST)
      .expect(201);
    const id = created.body.id as string;

    await bia.agent.get(`/api/v1/shopping-lists/${id}`).expect(404);
    await bia.agent.put(`/api/v1/shopping-lists/${id}`).send(LIST).expect(404);
    await bia.agent.delete(`/api/v1/shopping-lists/${id}`).expect(404);
    const biaLists = await bia.agent.get('/api/v1/shopping-lists').expect(200);
    expect(biaLists.body).toEqual([]);

    // Ana's list is untouched.
    const anaList = await ana.agent
      .get(`/api/v1/shopping-lists/${id}`)
      .expect(200);
    expect(anaList.body.name).toBe(LIST.name);
  });

  describe('guest → account migration', () => {
    async function guestReceipt(storeId: string, accessKey: string) {
      // Receipts arrive in phase 6; until then the guest upload is simulated here.
      return app.get(PrismaService).receipt.create({
        data: {
          accessKey,
          storeId,
          issuedAt: new Date(),
          total: 42.5,
          guestId: GUEST,
          raw: {},
        },
      });
    }

    it('imports device lists once and moves the guest receipts to the new account', async () => {
      const storeId = await createStore(app);
      const receipt = await guestReceipt(storeId, '3'.repeat(44));
      const { agent, user } = await signUp(app, 'nova@example.com');

      const payload = {
        guestId: GUEST,
        lists: [{ clientId: 'local-1', ...LIST }],
      };
      const first = await agent
        .post('/api/v1/shopping-lists/import')
        .send(payload)
        .expect(200);
      expect(first.body).toMatchObject({
        imported: 1,
        receiptsClaimed: 1,
        pricesClaimed: 0,
      });
      expect(first.body.lists).toHaveLength(1);
      expect(first.body.lists[0]).toMatchObject({
        clientId: 'local-1',
        name: LIST.name,
      });

      const owned = await app
        .get(PrismaService)
        .receipt.findUniqueOrThrow({ where: { id: receipt.id } });
      expect(owned.uploadedById).toBe(user.id);

      // Second import (e.g. signing in again on the same device) changes nothing.
      const again = await agent
        .post('/api/v1/shopping-lists/import')
        .send(payload)
        .expect(200);
      expect(again.body).toMatchObject({ imported: 0, receiptsClaimed: 0 });
      expect(again.body.lists).toHaveLength(1);
    });

    it('does not steal receipts already owned by another account', async () => {
      const storeId = await createStore(app);
      const first = await signUp(app, 'primeira@example.com');
      await first.agent
        .post('/api/v1/shopping-lists/import')
        .send({ guestId: GUEST, lists: [] })
        .expect(200);
      await guestReceipt(storeId, '4'.repeat(44));
      await first.agent
        .post('/api/v1/shopping-lists/import')
        .send({ guestId: GUEST, lists: [] })
        .expect(200);

      const second = await signUp(app, 'segunda@example.com');
      const res = await second.agent
        .post('/api/v1/shopping-lists/import')
        .send({ guestId: GUEST, lists: [] })
        .expect(200);
      expect(res.body.receiptsClaimed).toBe(0);
    });

    it('validates the payload', async () => {
      const { agent } = await signUp(app, 'nova@example.com');
      await agent
        .post('/api/v1/shopping-lists/import')
        .send({ guestId: 'abc', lists: [] })
        .expect(400);
      await agent
        .post('/api/v1/shopping-lists/import')
        .send({ lists: [{ clientId: 'x', name: 'Sem itens' }] })
        .expect(400);
    });
  });
});
