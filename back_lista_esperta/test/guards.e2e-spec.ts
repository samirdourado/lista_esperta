import { Controller, Post, UseGuards } from '@nestjs/common';
import request from 'supertest';
import type { Actor } from '../src/auth/auth.types.js';
import { CurrentActor, Public } from '../src/auth/decorators.js';
import { OptionalJwtAuthGuard } from '../src/auth/guards.js';
import {
  createStore,
  createTestApp,
  resetDatabase,
  signUp,
  signUpAdmin,
  type TestApp,
} from './helpers.js';

/** Test-only route shaped like the public write routes of phases 6–7. */
@Controller('test-probe')
class ActorProbeController {
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  probe(@CurrentActor() actor: Actor): Actor {
    return actor;
  }
}

const GUEST = '3f0c9a52-7a8e-4f6b-9a3c-2d1e0b4c5a6f';

describe('Guards (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ActorProbeController] });
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('RolesGuard + StoreMemberGuard on /stores/:storeId/members', () => {
    it('lets the store owner in', async () => {
      const owner = await signUp(app, 'dona@example.com', 'MERCHANT');
      const storeId = await createStore(app, owner.user.id);
      const res = await owner.agent
        .get(`/api/v1/stores/${storeId}/members`)
        .expect(200);
      expect(res.body).toEqual([
        { userId: owner.user.id, displayName: 'dona', memberRole: 'OWNER' },
      ]);
    });

    it('refuses a merchant of another store', async () => {
      const owner = await signUp(app, 'dona@example.com', 'MERCHANT');
      const other = await signUp(app, 'outro@example.com', 'MERCHANT');
      const storeId = await createStore(app, owner.user.id);
      await other.agent.get(`/api/v1/stores/${storeId}/members`).expect(403);
    });

    it('refuses shoppers by role, before looking at the store', async () => {
      const owner = await signUp(app, 'dona@example.com', 'MERCHANT');
      const shopper = await signUp(app, 'cliente@example.com', 'SHOPPER');
      const storeId = await createStore(app, owner.user.id);
      await shopper.agent.get(`/api/v1/stores/${storeId}/members`).expect(403);
    });

    it('lets admins in for moderation', async () => {
      const owner = await signUp(app, 'dona@example.com', 'MERCHANT');
      const admin = await signUpAdmin(app, 'admin@example.com');
      const storeId = await createStore(app, owner.user.id);
      await admin.agent.get(`/api/v1/stores/${storeId}/members`).expect(200);
    });

    it('requires a session and a valid store id', async () => {
      const owner = await signUp(app, 'dona@example.com', 'MERCHANT');
      const storeId = await createStore(app, owner.user.id);
      await request(app.getHttpServer())
        .get(`/api/v1/stores/${storeId}/members`)
        .expect(401);
      await owner.agent.get('/api/v1/stores/not-a-uuid/members').expect(404);
    });
  });

  describe('OptionalJwtAuthGuard + CurrentActor on public write routes', () => {
    it('attributes an anonymous request to the guest id', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/test-probe')
        .set('X-Guest-Id', GUEST)
        .expect(201);
      expect(res.body).toEqual({ guestId: GUEST });
    });

    it('attributes a signed-in request to the user', async () => {
      const shopper = await signUp(app, 'cliente@example.com');
      const res = await shopper.agent
        .post('/api/v1/test-probe')
        .set('X-Guest-Id', GUEST)
        .expect(201);
      expect(res.body).toEqual({ userId: shopper.user.id, guestId: GUEST });
    });

    it('treats an invalid token as anonymous instead of failing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/test-probe')
        .set('Cookie', 'le_access=forged.token.value')
        .expect(201);
      expect(res.body).toEqual({});
    });

    it('rejects a malformed guest id', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/test-probe')
        .set('X-Guest-Id', 'not-a-uuid')
        .expect(400);
    });
  });
});
