# back_lista_esperta

API NestJS 12 + Prisma 7 + PostgreSQL/PostGIS da Lista Esperta. O setup completo está no [README da raiz](../README.md).

- Swagger: http://localhost:3333/api/docs (JSON em `/api/docs-json`)
- Health: `GET /api/v1/health`

## Estrutura

```
prisma/
  schema.prisma            modelos (camelCase → snake_case via @map)
  migrations/              a primeira foi editada à mão (extensões; ver docs/DECISIONS.md D-019)
  seed.ts                  dados demo idempotentes
prisma.config.ts           conexão e seed (Prisma 7)
src/
  auth/                    cadastro, login, refresh com rotação, guards e decorators
  users/                   perfil e preferências de deslocamento (PATCH /users/me)
  stores/                  StoreMemberGuard, StoresGeoRepository (único acesso a `location`)
  shopping-lists/          listas dos usuários logados + importação guest → conta
  common/throttling.ts     rate limit por IP e por IP + X-Guest-Id
  config/env.schema.ts     validação das variáveis (a API não sobe se faltar alguma)
  generated/prisma/        client gerado (fora do git; `npm install` gera)
test/                      e2e com Supertest contra lista_esperta_test
```

## Regras que o código garante

- Toda rota exige sessão, a não ser que tenha `@Public()`.
- Rotas com `:storeId` passam pelo `StoreMemberGuard`.
- Consultas a listas sempre filtram por `userId`. A lista de outra pessoa responde 404.
- Geografia só via `StoresGeoRepository`, com `$queryRaw`/`$executeRaw` em tagged templates (parâmetros, nunca concatenação).

## Scripts

| Script | O que faz |
|---|---|
| `npm run start:dev` | API com watch |
| `npm run db:migrate` | `prisma migrate dev` (cria e aplica migrations) |
| `npm run db:deploy` | aplica migrations pendentes |
| `npm run db:seed` | dados de demonstração |
| `npm run db:studio` | Prisma Studio |
| `npm test` / `npm run test:e2e` | unitários / e2e (o e2e prepara o banco de teste antes) |
| `npm run lint` / `typecheck` / `format` | qualidade |
