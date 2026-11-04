import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StoresGeoRepository } from '../src/stores/stores-geo.repository.js';

export type TestApp = INestApplication<App>;

export async function createTestApp(
  extra: Pick<ModuleMetadata, 'controllers' | 'providers'> = {},
): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extra.controllers ?? [],
    providers: extra.providers ?? [],
  }).compile();
  const app = moduleRef.createNestApplication<TestApp>();
  configureApp(app);
  await app.init();
  return app;
}

/** Empties every table (except Prisma's migration log) so each suite starts clean. */
export async function resetDatabase(app: TestApp): Promise<void> {
  const prisma = app.get(PrismaService);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'spatial_ref_sys')`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  // Table names come from pg_catalog, not from user input.
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export const PASSWORD = 'senha-de-teste-123';

export interface SignedInAgent {
  agent: ReturnType<typeof request.agent>;
  user: { id: string; email: string; role: string };
}

/** Registers a user and returns a cookie-keeping agent signed in as them. */
export async function signUp(
  app: TestApp,
  email: string,
  role: 'SHOPPER' | 'MERCHANT' = 'SHOPPER',
): Promise<SignedInAgent> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post('/api/v1/auth/register')
    .send({ email, password: PASSWORD, displayName: email.split('@')[0], role })
    .expect(201);
  return { agent, user: (res.body as { user: SignedInAgent['user'] }).user };
}

/** Admins cannot sign up; tests promote a registered user directly. */
export async function signUpAdmin(
  app: TestApp,
  email: string,
): Promise<SignedInAgent> {
  const signed = await signUp(app, email);
  await app
    .get(PrismaService)
    .user.update({ where: { email }, data: { role: 'ADMIN' } });
  // Sign in again so the access token carries the new role.
  await signed.agent
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return signed;
}

export async function createStore(
  app: TestApp,
  ownerId?: string,
): Promise<string> {
  const storeId = await app.get(StoresGeoRepository).create({
    name: 'Loja de Teste',
    source: 'MERCHANT_REGISTERED',
    lat: -23.5891,
    lng: -46.6346,
  });
  if (ownerId) {
    await app.get(PrismaService).storeMember.create({
      data: { storeId, userId: ownerId, memberRole: 'OWNER' },
    });
  }
  return storeId;
}

/** Parses Set-Cookie headers into name → raw attribute string. */
export function cookiesOf(res: request.Response): Record<string, string> {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return Object.fromEntries(
    (header ?? []).map((cookie) => [cookie.split('=')[0], cookie]),
  );
}

export function cookieValue(raw: string | undefined): string {
  return raw?.split(';')[0].split('=').slice(1).join('=') ?? '';
}
