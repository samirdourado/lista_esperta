import request from 'supertest';
import { createTestApp, type TestApp } from './helpers.js';

describe('Rate limiting (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    // Other suites disable throttling; this one checks the real limits.
    process.env.THROTTLE_DISABLED = 'false';
    app = await createTestApp();
  });

  afterAll(async () => {
    process.env.THROTTLE_DISABLED = 'true';
    await app.close();
  });

  it('allows 10 login attempts per minute per client, then answers 429', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever-123' });

    for (let i = 0; i < 10; i += 1) {
      await attempt().expect(401);
    }
    await attempt().expect(429);
  });

  it('keeps the generous global limit on ordinary routes', async () => {
    for (let i = 0; i < 15; i += 1) {
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    }
  });
});
