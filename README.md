# Lista Esperta

> **Onde a minha lista inteira sai mais barata, perto de mim, hoje, contando o custo de ir até lá?**

PWA que compara o custo total de uma lista de compras entre lojas físicas próximas (supermercado, farmácia, materiais de construção, pet shop…), somando os preços e o deslocamento. O cliente usa sem cadastro.

## Estrutura

```
/
├── docker-compose.yml     ← db (PostGIS) + api (NestJS) + web (Next.js)
├── .env.example           ← variáveis do compose
├── docker/db/init/        ← script que cria o banco de teste
├── docs/                  ← AUDIT, BRAND, DECISIONS
├── back_lista_esperta/    ← API NestJS 12 + Prisma 7 (PostGIS)
└── front_lista_esperta/   ← PWA Next.js 16
```

## Como rodar

Pré-requisitos: Docker Desktop e, para rodar fora do Docker, Node.js 24 e npm 11.

```bash
cp .env.example .env
cp back_lista_esperta/.env.example back_lista_esperta/.env
```

Preencha `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` em `back_lista_esperta/.env` com dois valores diferentes e aleatórios. **A API não sobe sem eles.** Para gerar cada um:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Opção A — tudo em Docker

```bash
docker compose up --build
```

| Serviço | URL |
|---|---|
| Front (Next.js) | http://localhost:3000 |
| API | http://localhost:3333/api/v1/health |
| Swagger | http://localhost:3333/api/docs |
| PostgreSQL + PostGIS | `localhost:5433` (usuário/senha `lista`/`lista`) |

A API aplica as migrations sozinha ao subir (`prisma migrate deploy`). Para criar os dados de demonstração, rode uma vez `docker compose exec api npm run db:seed`.

O hot reload funciona pelo bind mount, com polling habilitado para o Windows. O compose sobrescreve `DATABASE_URL` para usar o host `db:5432` dentro da rede do Docker. Para reinstalar dependências depois de mudar um `package.json`, rode `docker compose up --build -V`.

### Opção B — só o banco em Docker

```bash
docker compose up -d db

cd back_lista_esperta && npm install
npm run db:deploy && npm run db:seed     # migrations + dados demo
npm run start:dev                        # http://localhost:3333

# em outro terminal
cd front_lista_esperta && npm install && npm run dev   # http://localhost:3000
```

Nesse modo, `back_lista_esperta/.env` usa `localhost:5433`, que é o valor do `.env.example`.

## Contas de demonstração (`npm run db:seed`)

| Conta | Senha | O que vê |
|---|---|---|
| `lojista@listaesperta.dev` | `lista-esperta-dev` | Lojista dono das duas lojas demo em São Paulo; entra em `/merchant` |
| `admin@listaesperta.dev` | `lista-esperta-dev` | Admin (o painel `/admin` chega na fase 8) |

A senha pode ser trocada com `SEED_PASSWORD`. Contas de cliente são criadas pela tela `/register`.

## Scripts (nos dois projetos)

| Script | O que faz |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` (no front, antes roda `next typegen`) |
| `npm run format` | Prettier |
| `npm test` | testes unitários (Vitest) |
| `npm run test:e2e` | só no back: aplica as migrations em `lista_esperta_test` e roda o e2e com Supertest |
| `npm run db:migrate` / `db:seed` / `db:studio` | só no back: Prisma |
| `npm run api:types` | só no front: regenera `lib/api/schema.d.ts` a partir do Swagger da API rodando |

## Status

**Fase 1 — auditoria e estrutura** ✅
- `docs/AUDIT.md`, `docs/BRAND.md` e `docs/DECISIONS.md`.
- `docker-compose.yml` com PostGIS 16-3.4 (porta 5433, healthcheck, volume nomeado, banco de teste), api e web com hot reload.
- Esqueleto NestJS: prefixo `/api/v1`, `ValidationPipe` global, CORS restrito ao front, validação de env na inicialização, Swagger em `/api/docs` e `GET /api/v1/health`.

**Fase 2 — base do front** ✅
- Design tokens medidos no logo, modo claro/escuro com botão no cabeçalho, contraste AA.
- Shell PWA: cabeçalho com "Tenho uma loja", barra de abas no celular, rodapé, link para pular ao conteúdo, aviso de sem internet.
- Manifest com ícones gerados a partir do logo, service worker com página `/offline` (só em produção).
- Componentes base em `components/ui/` e testes com Testing Library.
- Rotas em inglês (`/verdict`, `/receipts/import`, `/how-it-works`, `/merchant`); as antigas redirecionam.

As telas de lista, veredito, NFC-e e lojista ainda são o protótipo do hackathon (dados simulados em `lib/demo/`), agora sobre a base nova. Elas serão reescritas nas fases 4 a 7.

Para ver o PWA (service worker, offline, instalação): `cd front_lista_esperta && npm run build && npm start`.

**Fase 3 — banco e autenticação** ✅
- Schema Prisma com PostGIS (`geography(Point,4326)` + índice GIST) e `pg_trgm`, migration inicial e seed idempotente (categorias genéricas, admin, lojista com 2 lojas, 10 produtos com preços).
- Auth no Nest: cadastro e login (argon2id), access de 15 min e refresh de 7 dias em cookies httpOnly, rotação com detecção de reuso, logout que revoga.
- Guards: `JwtAuthGuard` global com `@Public()`, `RolesGuard`, `StoreMemberGuard`, `OptionalJwtAuthGuard` + `X-Guest-Id` para visitantes. Rate limit por IP e por IP + guestId.
- Listas no servidor só para quem tem conta, com filtro por dono, e `POST /shopping-lists/import` para a migração guest → conta.
- Front: login, cadastro ("Quero economizar" / "Tenho uma loja"), minha conta (nome e custo de deslocamento), onboarding do lojista, `proxy.ts` protegendo `/merchant`, `/admin` e `/account`, client tipado pelo OpenAPI com TanStack Query, listas do visitante no IndexedDB e convite discreto para criar conta depois do veredito.

Ainda simulado: os preços e as lojas do veredito (`lib/demo/`) e a localização, que cai no centro da Vila Mariana. Isso muda nas fases 4 (lojas reais e geolocalização) e 7 (veredito pela API).

Próximas fases: 4 · lojas → 5 · dashboard do lojista → 6 · NFC-e → 7 · lista + veredito → 8 · opcionais.

A documentação do protótipo (arquitetura, motor de decisão, monetização) continua em [front_lista_esperta/docs/](front_lista_esperta/docs/README.md).
