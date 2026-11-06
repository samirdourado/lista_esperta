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
  users/                   perfil e raio de busca (PATCH /users/me)
  stores/                  lojas: busca por perto, cadastro, verificação de CNPJ, descoberta em segundo plano,
                           StoreMemberGuard e StoresGeoRepository (único acesso a `location`)
  store-claims/            "esta loja é minha": reivindicação, aprovada na hora com CNPJ que bate
  admin/                   moderação: reivindicações, verificações, aliases pendentes e duplicados (só ADMIN)
  geocoding/               endereço ↔ coordenada para quem não libera a localização
  products/                catálogo público, busca por código de barras (Open Food Facts), categorias
  prices/                  catálogo da loja, preços e ofertas, importação CSV, visão geral (mediana, NFC-e, procura)
  verdict/                 veredito: engine.ts (puro, testado), preço vigente por loja, horário de funcionamento,
                           procura anônima; POST /verdict e POST /lists/parse-photo
  integrations/routes/     distância e tempo: OpenRouteService com ORS_API_KEY, senão estimativa (linha reta × 1,3)
  flyers/                  encartes: Firecrawl → Gemini → normalização → preços FLYER (POST /stores/:id/flyers)
  alerts/                  alertas de preço e Web Push (VAPID próprio); checagem periódica
  integrations/firecrawl/  cliente do Firecrawl (POST /v2/scrape)
  web-prices/              menores preços do Google Shopping (SerpApi) para a lista, com cache; GET /web-prices
  integrations/serpapi/    cliente do SerpApi (google_shopping e locations)
  sponsored/               conteúdo patrocinado, fora do motor (regra de lint + teste e2e de neutralidade)
  storage/                 StorageService (disco local hoje) para fotos de loja e de nota
  receipts/                NFC-e: chave de acesso, parsers por UF (parsers/sp.parser.ts), foto via Gemini, normalização
  integrations/gemini/     cliente REST do Gemini com responseSchema, validação e fallback de modelos
  integrations/            OpenStreetMap (Overpass), Nominatim, BrasilAPI atrás de interfaces
  shopping-lists/          listas dos usuários logados + importação guest → conta
  common/throttling.ts     rate limit por IP e por IP + X-Guest-Id
  config/env.schema.ts     validação das variáveis (a API não sobe se faltar alguma)
  generated/prisma/        client gerado (fora do git; `npm install` gera)
test/                      e2e com Supertest contra lista_esperta_test; fixtures/nfce/ com páginas da SEFAZ
scripts/gemini-smoke.ts    teste manual do Gemini real (npx tsx scripts/gemini-smoke.ts)
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
