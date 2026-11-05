/**
 * Demo data so the app works on an empty database. Idempotent: run it again
 * and nothing is duplicated (fixed ids + upserts).
 *
 *   npm run db:seed
 *
 * Accounts (password from SEED_PASSWORD, default "lista-esperta-dev"):
 *   admin@listaesperta.dev     ADMIN
 *   lojista@listaesperta.dev   MERCHANT, OWNER of the two demo stores
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { MeasureUnit } from '../src/generated/prisma/enums.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const password = process.env.SEED_PASSWORD ?? 'lista-esperta-dev';

/** Generic, hierarchical: a store is any physical shop, not only groceries. */
const CATEGORY_TREE: Record<
  string,
  { name: string; children?: Record<string, string> }
> = {
  alimentos: {
    name: 'Alimentos',
    children: {
      mercearia: 'Mercearia',
      laticinios: 'Laticínios',
      hortifruti: 'Hortifrúti',
      acougue: 'Açougue',
      padaria: 'Padaria',
      bebidas: 'Bebidas',
    },
  },
  limpeza: { name: 'Limpeza' },
  higiene: { name: 'Higiene e beleza' },
  farmacia: {
    name: 'Farmácia',
    children: {
      medicamentos: 'Medicamentos',
      'cuidados-pessoais': 'Cuidados pessoais',
    },
  },
  eletrodomesticos: { name: 'Eletrodomésticos' },
  eletronicos: { name: 'Eletrônicos' },
  construcao: {
    name: 'Materiais de construção',
    children: { ferramentas: 'Ferramentas', tintas: 'Tintas' },
  },
  pet: { name: 'Pet shop' },
  papelaria: { name: 'Papelaria' },
};

const STORES = [
  {
    id: '6a1d3c7e-1f2a-4b6c-9d01-5e7f8a9b0c11',
    name: 'Mercado Demo Vila Mariana',
    lat: -23.5891,
    lng: -46.6346,
    address: {
      street: 'Rua Domingos de Morais',
      city: 'São Paulo',
      state: 'SP',
    },
    openingHours: { mon_sat: '07:00-22:00', sun: '08:00-20:00' },
  },
  {
    id: '6a1d3c7e-1f2a-4b6c-9d01-5e7f8a9b0c22',
    name: 'Mercado Demo Paraíso',
    lat: -23.5747,
    lng: -46.6409,
    address: { street: 'Rua Vergueiro', city: 'São Paulo', state: 'SP' },
    openingHours: { mon_sun: '00:00-24:00' },
  },
] as const;

type SeedProduct = {
  id: string;
  name: string;
  brand?: string;
  category: string;
  unit: MeasureUnit;
  quantity: number;
  prices: [number, number];
};

const PRODUCTS: SeedProduct[] = [
  {
    id: '7b2e4d8f-0000-4000-8000-000000000001',
    name: 'Arroz branco tipo 1 5 kg',
    brand: 'Marca Demo',
    category: 'mercearia',
    unit: 'KG',
    quantity: 5,
    prices: [27.9, 25.49],
  },
  {
    id: '7b2e4d8f-0000-4000-8000-000000000002',
    name: 'Feijão carioca 1 kg',
    brand: 'Marca Demo',
    category: 'mercearia',
    unit: 'KG',
    quantity: 1,
    prices: [8.99, 9.49],
  },
  {
    id: '7b2e4d8f-0000-4000-8000-000000000003',
    name: 'Café torrado e moído 500 g',
    brand: 'Marca Demo',
    category: 'mercearia',
    unit: 'G',
    quantity: 500,
    prices: [18.9, 16.99],
  },
  {
    id: '7b2e4d8f-0000-4000-8000-000000000004',
    name: 'Leite UHT integral 1 L',
    brand: 'Marca Demo',
    category: 'laticinios',
    unit: 'L',
    quantity: 1,
    prices: [5.29, 4.99],
  },
  {
    id: '7b2e4d8f-0000-4000-8000-000000000005',
    name: 'Banana prata',
    category: 'hortifruti',
    unit: 'KG',
    quantity: 1,
    prices: [6.99, 7.49],
  },
  {
    id: '7b2e4d8f-0000-4000-8000-000000000006',
    name: 'Detergente líquido 500 ml',
    brand: 'Marca Demo',
    category: 'limpeza',
    unit: 'ML',
    quantity: 500,
    prices: [2.79, 2.49],
  },
  {
    id: '7b2e4d8f-0000-4000-8000-000000000007',
    name: 'Papel higiênico folha dupla 12 rolos',
    brand: 'Marca Demo',
    category: 'higiene',
    unit: 'UN',
    quantity: 12,
    prices: [21.9, 19.9],
  },
  {
    id: '7b2e4d8f-0000-4000-8000-000000000008',
    name: 'Ração para cães adultos 3 kg',
    brand: 'Marca Demo',
    category: 'pet',
    unit: 'KG',
    quantity: 3,
    prices: [49.9, 54.9],
  },
  {
    id: '7b2e4d8f-0000-4000-8000-000000000009',
    name: 'Caderno universitário 10 matérias',
    category: 'papelaria',
    unit: 'UN',
    quantity: 1,
    prices: [24.9, 22.5],
  },
  {
    id: '7b2e4d8f-0000-4000-8000-000000000010',
    name: 'Lâmpada LED 9 W',
    category: 'construcao',
    unit: 'UN',
    quantity: 1,
    prices: [9.9, 8.79],
  },
];

async function seedCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [slug, node] of Object.entries(CATEGORY_TREE)) {
    const parent = await prisma.category.upsert({
      where: { slug },
      update: { name: node.name, parentId: null },
      create: { slug, name: node.name },
    });
    ids.set(slug, parent.id);
    for (const [childSlug, childName] of Object.entries(node.children ?? {})) {
      const child = await prisma.category.upsert({
        where: { slug: childSlug },
        update: { name: childName, parentId: parent.id },
        create: { slug: childSlug, name: childName, parentId: parent.id },
      });
      ids.set(childSlug, child.id);
    }
  }
  return ids;
}

async function seedUser(
  email: string,
  displayName: string,
  role: 'ADMIN' | 'MERCHANT',
) {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  return prisma.user.upsert({
    where: { email },
    update: { role, displayName },
    create: { email, displayName, role, passwordHash },
  });
}

async function seedStores(ownerId: string) {
  for (const store of STORES) {
    // Geography columns are written with raw SQL (tagged template = bind parameters).
    await prisma.$executeRaw`
      INSERT INTO stores (id, name, source, verification_status, location, address, opening_hours)
      VALUES (
        ${store.id}::uuid, ${store.name}, 'MERCHANT_REGISTERED'::"StoreSource", 'UNVERIFIED'::"VerificationStatus",
        ST_SetSRID(ST_MakePoint(${store.lng}, ${store.lat}), 4326)::geography,
        ${JSON.stringify(store.address)}::jsonb, ${JSON.stringify(store.openingHours)}::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, location = EXCLUDED.location,
        address = EXCLUDED.address, opening_hours = EXCLUDED.opening_hours`;
    // Demo stores sell groceries and cleaning products.
    for (const slug of ['alimentos', 'limpeza']) {
      const category = await prisma.category.findUniqueOrThrow({
        where: { slug },
      });
      await prisma.storeCategory.upsert({
        where: {
          storeId_categoryId: { storeId: store.id, categoryId: category.id },
        },
        update: {},
        create: { storeId: store.id, categoryId: category.id },
      });
    }
    await prisma.storeMember.upsert({
      where: { storeId_userId: { storeId: store.id, userId: ownerId } },
      update: { memberRole: 'OWNER' },
      create: { storeId: store.id, userId: ownerId, memberRole: 'OWNER' },
    });
  }
}

async function seedProducts(
  categoryIds: Map<string, string>,
  merchantId: string,
) {
  for (const product of PRODUCTS) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`Unknown category ${product.category}`);
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        canonicalName: product.name,
        brand: product.brand ?? null,
        categoryId,
        unit: product.unit,
        unitQuantity: product.quantity,
      },
      create: {
        id: product.id,
        canonicalName: product.name,
        brand: product.brand ?? null,
        categoryId,
        unit: product.unit,
        unitQuantity: product.quantity,
      },
    });
    // Prices are dated observations: replace the demo ones instead of piling them up.
    await prisma.priceObservation.deleteMany({
      where: {
        productId: product.id,
        source: 'MERCHANT',
        reportedById: merchantId,
      },
    });
    await prisma.priceObservation.createMany({
      data: STORES.map((store, index) => ({
        productId: product.id,
        storeId: store.id,
        price: product.prices[index],
        source: 'MERCHANT' as const,
        reportedById: merchantId,
        observedAt: new Date(),
      })),
    });
  }
}

async function main() {
  const categories = await seedCategories();
  await seedUser('admin@listaesperta.dev', 'Admin Lista Esperta', 'ADMIN');
  const merchant = await seedUser(
    'lojista@listaesperta.dev',
    'Lojista Demo',
    'MERCHANT',
  );
  await seedStores(merchant.id);
  await seedProducts(categories, merchant.id);
  console.log(
    `Seed ok: ${categories.size} categories, ${STORES.length} stores, ${PRODUCTS.length} products.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
