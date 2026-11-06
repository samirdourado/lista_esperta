import request from 'supertest';
import {
  cookiesOf,
  cookieValue,
  createTestApp,
  PASSWORD,
  resetDatabase,
  signUp,
  type TestApp,
} from './helpers.js';

describe('Auth (e2e)', () => {
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

  const server = () => app.getHttpServer();

  it('registers a shopper and sets httpOnly, SameSite=Lax session cookies', async () => {
    const res = await request(server())
      .post('/api/v1/auth/register')
      .send({
        email: '  Ana@Example.com ',
        password: PASSWORD,
        displayName: 'Ana',
        role: 'SHOPPER',
      })
      .expect(201);

    expect(res.body.user).toMatchObject({
      email: 'ana@example.com',
      role: 'SHOPPER',
      displayName: 'Ana',
      defaultRadiusKm: 5,
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('costPerKm');

    const cookies = cookiesOf(res);
    expect(cookies.le_access).toMatch(/HttpOnly/);
    expect(cookies.le_access).toMatch(/SameSite=Lax/);
    expect(cookies.le_access).toMatch(/Path=\//);
    expect(cookies.le_refresh).toMatch(/HttpOnly/);
    expect(cookies.le_refresh).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('never lets self sign-up create an admin', async () => {
    await request(server())
      .post('/api/v1/auth/register')
      .send({
        email: 'x@example.com',
        password: PASSWORD,
        displayName: 'X',
        role: 'ADMIN',
      })
      .expect(400);
  });

  it('rejects unknown fields and short passwords', async () => {
    await request(server())
      .post('/api/v1/auth/register')
      .send({
        email: 'x@example.com',
        password: 'curta',
        displayName: 'X',
        role: 'SHOPPER',
      })
      .expect(400);
    await request(server())
      .post('/api/v1/auth/register')
      .send({
        email: 'x@example.com',
        password: PASSWORD,
        displayName: 'X',
        role: 'SHOPPER',
        isAdmin: true,
      })
      .expect(400);
  });

  it('rejects a duplicate e-mail with 409', async () => {
    await signUp(app, 'dup@example.com');
    await request(server())
      .post('/api/v1/auth/register')
      .send({
        email: 'DUP@example.com',
        password: PASSWORD,
        displayName: 'D',
        role: 'MERCHANT',
      })
      .expect(409);
  });

  it('logs in, returns the profile on /me and refuses /me without a session', async () => {
    await signUp(app, 'bia@example.com', 'MERCHANT');
    await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'bia@example.com', password: 'wrong-password' })
      .expect(401);
    await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD })
      .expect(401);

    const agent = request.agent(server());
    await agent
      .post('/api/v1/auth/login')
      .send({ email: 'bia@example.com', password: PASSWORD })
      .expect(200);
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({
      email: 'bia@example.com',
      role: 'MERCHANT',
    });

    await request(server()).get('/api/v1/auth/me').expect(401);
  });

  it('rotates the refresh token and revokes every session when an old one is reused', async () => {
    const signup = await request(server())
      .post('/api/v1/auth/register')
      .send({
        email: 'cid@example.com',
        password: PASSWORD,
        displayName: 'Cid',
        role: 'SHOPPER',
      })
      .expect(201);
    const firstRefresh = cookieValue(cookiesOf(signup).le_refresh);

    const rotated = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `le_refresh=${firstRefresh}`)
      .expect(200);
    const secondRefresh = cookieValue(cookiesOf(rotated).le_refresh);
    expect(secondRefresh).not.toBe(firstRefresh);
    expect(cookieValue(cookiesOf(rotated).le_access)).not.toBe('');

    // Replaying the first token is treated as theft: it fails and clears cookies…
    const replay = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `le_refresh=${firstRefresh}`)
      .expect(401);
    expect(cookiesOf(replay).le_refresh).toMatch(/Expires=Thu, 01 Jan 1970/);

    // …and the legitimate newer token is revoked too.
    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `le_refresh=${secondRefresh}`)
      .expect(401);
  });

  it('rejects refresh without a cookie or with a forged token', async () => {
    await request(server()).post('/api/v1/auth/refresh').expect(401);
    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'le_refresh=not-a-jwt')
      .expect(401);
  });

  it('logout revokes the refresh token and clears both cookies', async () => {
    const signup = await request(server())
      .post('/api/v1/auth/register')
      .send({
        email: 'dani@example.com',
        password: PASSWORD,
        displayName: 'Dani',
        role: 'SHOPPER',
      })
      .expect(201);
    const refresh = cookieValue(cookiesOf(signup).le_refresh);

    const out = await request(server())
      .post('/api/v1/auth/logout')
      .set('Cookie', `le_refresh=${refresh}`)
      .expect(204);
    expect(cookiesOf(out).le_access).toMatch(/Expires=Thu, 01 Jan 1970/);

    await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `le_refresh=${refresh}`)
      .expect(401);
  });

  it('updates the search radius of the signed-in user', async () => {
    const { agent } = await signUp(app, 'edu@example.com');
    const res = await agent
      .patch('/api/v1/users/me')
      .send({ defaultRadiusKm: 3 })
      .expect(200);
    expect(res.body).toMatchObject({ defaultRadiusKm: 3 });
    // Travel cost and the value of time are gone (D-069).
    await agent.patch('/api/v1/users/me').send({ costPerKm: 1 }).expect(400);

    await agent.patch('/api/v1/users/me').send({ role: 'ADMIN' }).expect(400);
  });
});
