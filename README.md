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
├── back_lista_esperta/    ← API NestJS 12 (+ Prisma a partir da fase 3)
└── front_lista_esperta/   ← PWA Next.js 16
```

## Como rodar

Pré-requisitos: Docker Desktop e, para rodar fora do Docker, Node.js 24 e npm 11.

```bash
cp .env.example .env
cp back_lista_esperta/.env.example back_lista_esperta/.env
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

O hot reload funciona pelo bind mount, com polling habilitado para o Windows. O compose sobrescreve `DATABASE_URL` para usar o host `db:5432` dentro da rede do Docker. Para reinstalar dependências depois de mudar um `package.json`, rode `docker compose up --build -V`.

### Opção B — só o banco em Docker

```bash
docker compose up -d db

cd back_lista_esperta && npm install && npm run start:dev    # http://localhost:3333
cd front_lista_esperta && npm install && npm run dev         # http://localhost:3000
```

Nesse modo, `back_lista_esperta/.env` usa `localhost:5433`, que é o valor do `.env.example`.

## Scripts (nos dois projetos)

| Script | O que faz |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testes unitários (Vitest) |
| `npm run test:e2e` | só no back: e2e com Supertest contra `lista_esperta_test` |

## Status

**Fase 1 — auditoria e estrutura** ✅
- `docs/AUDIT.md`, `docs/BRAND.md` e `docs/DECISIONS.md`.
- `docker-compose.yml` com PostGIS 16-3.4 (porta 5433, healthcheck, volume nomeado, banco de teste), api e web com hot reload.
- Esqueleto NestJS: prefixo `/api/v1`, `ValidationPipe` global, CORS restrito ao front, validação de env na inicialização, Swagger em `/api/docs` e `GET /api/v1/health`.

O front ainda é o protótipo do hackathon (dados simulados em `lib/demo/`). Ele será reescrito a partir da fase 2.

Próximas fases: 2 · base do front → 3 · banco + auth → 4 · lojas → 5 · dashboard do lojista → 6 · NFC-e → 7 · lista + veredito → 8 · opcionais.

A documentação do protótipo (arquitetura, motor de decisão, monetização) continua em [front_lista_esperta/docs/](front_lista_esperta/docs/README.md).
