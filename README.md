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
| `admin@listaesperta.dev` | `lista-esperta-dev` | Admin; entra em `/admin` |

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

Para ver o PWA (service worker, offline, instalação): `cd front_lista_esperta && npm run build && npm start`.

**Fase 3 — banco e autenticação** ✅
- Schema Prisma com PostGIS (`geography(Point,4326)` + índice GIST) e `pg_trgm`, migration inicial e seed idempotente (categorias genéricas, admin, lojista com 2 lojas, 10 produtos com preços).
- Auth no Nest: cadastro e login (argon2id), access de 15 min e refresh de 7 dias em cookies httpOnly, rotação com detecção de reuso, logout que revoga.
- Guards: `JwtAuthGuard` global com `@Public()`, `RolesGuard`, `StoreMemberGuard`, `OptionalJwtAuthGuard` + `X-Guest-Id` para visitantes. Rate limit por IP e por IP + guestId.
- Listas no servidor só para quem tem conta, com filtro por dono, e `POST /shopping-lists/import` para a migração guest → conta.
- Front: login, cadastro ("Quero economizar" / "Tenho uma loja"), minha conta (nome e custo de deslocamento), onboarding do lojista, `proxy.ts` protegendo `/merchant`, `/admin` e `/account`, client tipado pelo OpenAPI com TanStack Query, listas do visitante no IndexedDB e convite discreto para criar conta depois do veredito.

**Fase 4 — lojas** ✅ (mapas 100% gratuitos, sem chave; ver `docs/DECISIONS.md` D-031)
- Lojas reais do OpenStreetMap, importadas em segundo plano por área e guardadas por 30 dias, com deduplicação por CNPJ ou por proximidade (< 50 m) + nome parecido.
- `/stores` (sem login): mapa (MapLibre + OpenFreeMap, claro e escuro) e lista por distância, raio de 1 a 10 km, sua localização real ou um endereço digitado, selo discreto de "Loja não verificada".
- Onboarding do lojista: encontrar a loja no mapa e pedir para administrá-la, ou cadastrar com pin ajustável, horários e categorias.
- CNPJ conferido na BrasilAPI: dígitos, situação ativa, cidade/UF/CEP e nome → `VERIFIED` ou `PENDING` (para o admin). Reivindicação com CNPJ que bate é aprovada na hora.
- API de moderação para o admin (`/admin/...`, pelo Swagger; as telas são da fase 8).
- Hot reload do front no Docker corrigido (polling do Turbopack).

A primeira vez que uma região é aberta, as lojas levam até um minuto para aparecer: o serviço gratuito do OpenStreetMap é lento e a importação roda em segundo plano. Depois, ficam no banco.

**Fase 5 — painel do lojista** ✅
- `/merchant/stores/[id]`: visão geral (produtos com preço, ofertas, posição frente à mediana da região, notas fiscais com preço diferente, procura anônima na região com k ≥ 10), produtos e preços com edição em massa, ofertas com validade, "não vendo mais", busca por código de barras (catálogo e Open Food Facts), importação de planilha CSV com relatório por linha, equipe (dono adiciona e remove) e fotos da loja.
- API: `/products` (busca pública), `/products/lookup/:gtin`, `/categories`, `/stores/:id/{overview,products,prices,prices/import,offers,members,photos}`.

**Fase 6 — NFC-e** ✅ (com uma limitação: ver abaixo)
- `/receipts/import` sem conta: QR Code pela câmera (`@zxing/browser`), link colado, foto da nota (Gemini) ou chave digitada (validação do dígito verificador).
- API: `POST /receipts/qr` (parser da SEFAZ-SP numa strategy por UF, só hosts oficiais), `POST /receipts/photo`, `POST /receipts/key`, `GET /receipts/mine`, `POST /prices/community`.
- Normalização de cada item: código de barras → alias conhecido → Gemini com JSON validado. Confiança < 0,8 fica pendente para o admin; nunca mistura unidades, tamanhos ou marcas.
- A loja vem do CNPJ da nota (cadastrada, unificada com a do mapa ou criada).
- **Limitação:** daqui, a SEFAZ-SP recusa a conexão do servidor, então a leitura pelo QR não pôde ser testada com uma nota real. A foto funciona (testada com o Gemini real). Detalhes e caminhos em `docs/DECISIONS.md` D-046/D-047.

**Fase 7 — lista e veredito** ✅ (sem dados simulados)
- `/` monta a lista: texto livre com quantidade ("2 leite", "ovos x 12"), autocompletar do catálogo pelo teclado, colar várias linhas ou foto da lista (Gemini, pela API). Fica salva no aparelho ou na conta.
- `/verdict` usa a sua localização real (ou um endereço) e responde qual loja sai mais barata pelo **custo total**: itens + mediana da região para o que faltar + ida e volta × R$/km + tempo × valor da hora. Sugere dividir em duas lojas quando economiza mais de R$ 10 e mais de 5%. Mostra a origem de cada preço, os itens sem preço, as lojas fechadas que ficaram de fora e o bloco "Patrocinado" separado do ranking.
- Raio (1 a 10 km), R$/km e valor da hora ajustáveis na própria tela: na conta, para quem entrou; no aparelho, para visitantes.
- API: `POST /verdict` (sem login, motor puro e testado), `POST /lists/parse-photo`. Neutralidade garantida por regra de lint nos dois projetos e por teste e2e.
- O protótipo (`lib/demo/`, rotas `app/api/*`) foi removido.

As distâncias são estimadas (linha reta × 1,3) até você colocar uma `ORS_API_KEY` gratuita no `.env` (D-054).

**Fase 8 — opcionais** ✅
- **Encartes:** no painel da loja, aba Encartes. O lojista cola o link (página ou PDF); o Firecrawl lê, o Gemini extrai produtos e preços, e eles entram como "Encarte da loja" até o fim das ofertas (D-064).
- **Alertas de preço** (`/alerts`, para quem tem conta): "avise quando custar até R$ X perto de mim", com notificação pelo navegador (Web Push com chaves próprias, sem serviço pago) e o menor preço atual de cada alerta. Atalho "Avisar quando baixar" em cada item do veredito (D-065).
- **Painel do admin** (`/admin`): reivindicações, lojas com CNPJ para conferir (com o registro da Receita lado a lado), produtos de notas e encartes para confirmar (aprovar já cria os preços que esperavam) e mesclagem de produtos duplicados, sem nunca misturar tamanhos ou marcas (D-066).

Para testar as notificações no computador: `cd front_lista_esperta && npm run build && npm start`, entre com uma conta, abra `/alerts` e toque em "Ligar notificações".

A documentação do protótipo (arquitetura, motor de decisão, monetização) continua em [front_lista_esperta/docs/](front_lista_esperta/docs/README.md).
