# Decisões

Registro de decisões tomadas onde a especificação era ambígua ou conflitava com o ambiente. A mais recente fica no topo de cada fase.

## Fase 3

### D-019 · Migration inicial editada à mão
Criada com `prisma migrate dev --create-only`, com três ajustes à mão:
- as extensões `postgis` e `pg_trgm` no topo;
- `NULLS NOT DISTINCT` no único `(raw_text, store_id)` de `product_aliases`. Sem isso, aliases globais (`store_id` nulo) poderiam se repetir.
- os índices GIST (`stores_location_gix`) e GIN de trigram ficam declarados no próprio `schema.prisma` (`@@index(..., type: Gist)` / `ops: raw("gin_trgm_ops")`), gerando o mesmo SQL da especificação. Assim, o `prisma migrate diff` não acusa drift (verificado: "empty migration").

### D-020 · Prisma 7
O Prisma 7 mudou a configuração:
- a conexão fica em `prisma.config.ts`;
- o client exige driver adapter (`@prisma/adapter-pg`);
- o gerador `prisma-client` escreve em `src/generated/prisma`, que fica fora do git e é gerado no `postinstall`.

O config usa `process.env.DATABASE_URL` em vez de `env()`, porque `env()` faz o `prisma generate` falhar durante o `npm ci` do Docker, onde ainda não existe banco. Usei a versão 7.10.1: a `latest` do npm aponta para uma RC da 8.

### D-021 · Scripts de instalação do npm 11
O npm 11 bloqueia scripts de instalação por padrão. Aprovei os do Prisma (que baixa o schema engine), do esbuild e do argon2 em `allowScripts`. Neguei o `@scarf/scarf`, que é só telemetria.

### D-022 · Sessão
- **Access token:** JWT HS256 de 15 min, no cookie `le_access` (`Path=/`).
- **Refresh token:** JWT de 7 dias no cookie `le_refresh`, com `Path=/api/v1/auth`, para viajar só às rotas de auth. O banco guarda só o SHA-256, e o `jti` é o id da linha.
- **Rotação:** cada `/auth/refresh` revoga o token usado. Reapresentar um token já revogado é tratado como vazamento: todas as sessões do usuário são revogadas. Duas rotações simultâneas do mesmo token não passam juntas (`updateMany ... revokedAt: null`).
- **Login:** quando o e-mail não existe, o login ainda roda um `argon2.verify` falso, para o tempo de resposta não revelar quem tem conta.
- **Cadastro:** os e-mails são normalizados para minúsculas. O auto-cadastro só cria `SHOPPER` ou `MERCHANT`, nunca `ADMIN`.
- **Hash de senha:** argon2id com os parâmetros recomendados pela OWASP (19 MiB, t=2).

### D-023 · Proteção de rotas no front (`proxy.ts`)
`/merchant`, `/admin` e `/account` passam pelo `proxy.ts`, que consulta `GET /auth/me` repassando o cookie:
- **Sem sessão:** vai para `/login?next=…`. Como o cookie de refresh não chega ao front (ver D-022), é a tela de login que tenta renovar a sessão em silêncio pelo navegador. Se conseguir, volta direto para a página pedida.
- **API fora do ar:** falha fechada (`/login?error=unavailable`).
- **Papel errado:** volta para `/account?denied=…`.
- **Lojista sem loja:** vai para `/merchant/onboarding`.

Dentro do Docker, o servidor do Next chama a API por `API_INTERNAL_URL=http://api:3333/api/v1`.

**Produção:** front e API precisam ser do mesmo *site*, por exemplo `app.exemplo.com` e `api.exemplo.com`, para que cookies `SameSite=Lax` funcionem. Em localhost isso já vale, porque cookies ignoram a porta.

### D-024 · Admin passa no `StoreMemberGuard`
Para moderar, o admin acessa qualquer `:storeId`. O `RolesGuard` não dá passe livre implícito: cada rota lista os papéis aceitos.

### D-025 · Dois baldes de rate limit
- `ip`: 300/min por IP.
- `default`: 120/min por IP + `X-Guest-Id`.

Trocar de `guestId` não escapa do limite por IP. As rotas `/auth` apertam os dois (20/min por IP e 10/min por cliente). Os e2e desligam o limite com `THROTTLE_DISABLED=true`, exceto `throttling.e2e-spec.ts`, que testa o 429.

### D-026 · Migração guest → conta
`POST /shopping-lists/import` é idempotente pelo id local da lista (`clientId`, único por usuário). Se a lista já foi importada, vale a cópia do servidor, que passa a ser a fonte de verdade. Notas e preços enviados com aquele `guestId` passam para a conta, mas só os que ainda não têm dono. No front, as listas locais são apagadas depois da importação. Se a importação falhar, elas ficam no aparelho e são enviadas de novo no próximo login.

Quem conhece o `guestId` de um aparelho pode reivindicar as notas daquele aparelho. O risco é aceito: é um UUID aleatório que nunca sai do aparelho, a não ser no header das gravações.

### D-027 · Escopo antecipado e adiado
- **Antecipado:** `GET /stores/:storeId/members` (equipe da loja, que seria da fase 5) já existe, para exercitar `RolesGuard` + `StoreMemberGuard` nos testes.
- **Adiado:** o onboarding do lojista por enquanto só explica os passos. O cadastro e a reivindicação da loja são da fase 4.
- **Rota de teste:** o `OptionalJwtAuthGuard` é testado por uma rota que só existe nos testes, porque as rotas públicas que gravam dados chegam nas fases 6 e 7.

### D-028 · Dados do catálogo
- **Slugs das categorias:** são dados, não código, e ficam em português (`laticinios`, `construcao`), como no exemplo de saída do Gemini da especificação.
- **Unidades:** `MeasureUnit` é um enum (`UN, G, KG, ML, L, M, M2`), para a regra de nunca comparar unidades diferentes ser garantida pelo banco.

### D-029 · `/account` dentro do grupo `(shopper)`
A rota é `/account`, como pede a especificação. Fica no grupo `(shopper)` para reaproveitar o cabeçalho e a barra de abas.

### D-030 · Painel do protótipo atrás do login
`/merchant` agora exige conta de lojista. Para ver o painel de demonstração, entre com `lojista@listaesperta.dev` (criado pelo seed).

## Fase 2

### D-011 · Tokens com `light-dark()`
Cada cor é declarada uma vez (`--brand: light-dark(#0754e0, #6b9bff)`). `color-scheme: light dark` segue o aparelho, e `<html data-theme="light|dark">` força o tema. Isso evita duplicar a paleta em `@media` e em `[data-theme]`. O suporte em navegadores é amplo desde 2024. Um script inline (`THEME_BOOT_SCRIPT`) aplica a preferência salva antes da primeira pintura, seguindo o guia `preventing-flash-before-hydration` do Next 16.

### D-012 · Protótipo mantido sobre a nova base
As telas do hackathon (lista, veredito, NFC-e, painel) continuam funcionando com dados simulados, agora nas rotas em inglês e dentro do novo shell. Cada uma é reescrita na sua fase (3 a 7). Assim, sempre há algo navegável para revisar. Os tokens antigos que essas telas usam (`save`, `amber`, `tag`, `muted-soft`) viraram aliases dos novos em `@theme` e saem junto com elas.

### D-013 · Rotas renomeadas com redirecionamento
`/veredito` → `/verdict`, `/nota` → `/receipts/import`, `/lojista` → `/merchant`, `/transparencia` → `/how-it-works`. São redirects 308 em `next.config.ts`, para não quebrar links já compartilhados da demo.

### D-014 · Service worker escrito à mão
O guia do Next 16 sugere o Serwist para cache offline completo. Preferi um `public/sw.js` de cerca de 80 linhas: o requisito offline é pequeno (a última lista e o último veredito virão do IndexedDB, não do cache HTTP), e o Serwist exigiria configuração extra do Turbopack. Ele só é registrado em produção, para não esconder o hot reload. O `experimental.useOffline` do Next cobre o aviso de conexão e o retry de navegação.

### D-015 · Testes de componente em jsdom por arquivo
O Vitest 5 removeu `environmentMatchGlobs`. O ambiente padrão continua `node` (testes de `lib/`), e cada `*.test.tsx` declara `// @vitest-environment jsdom`.

### D-016 · `typecheck` roda `next typegen`
Os tipos `PageProps<"/rota">` / `LayoutProps` são gerados pelo Next. `npm run typecheck` executa `next typegen && tsc --noEmit`, para não depender de um `next dev` ou `next build` anterior.

### D-017 · Mobile: barra de abas no rodapé
No celular, a navegação principal fica numa barra fixa com 3 abas (Minha lista, Enviar nota, Como calculamos), ao alcance do polegar. A partir de 768 px, os mesmos links ficam no cabeçalho. "Tenho uma loja" aparece sempre no cabeçalho e no rodapé, como pede a especificação. "Entrar" só entra na fase 3, junto com as telas de login.

### D-018 · Timeout maior no e2e do backend
O e2e do back falhou duas vezes com "2 skipped", sempre logo depois de muitas alterações de arquivo, com os containers recompilando. Forçar `--hookTimeout=50` reproduz exatamente esse sintoma, então a causa provável é o `beforeAll` (subida do Nest) passar dos 10 s padrão sob carga. `vitest.config.e2e.ts` agora usa `hookTimeout: 30_000` e `testTimeout: 15_000`.

## Fase 1

### D-001 · O front permanece em `front_lista_esperta/`
O Next.js já estava nessa pasta, então não houve `git mv`.

### D-002 · Backend usa Vitest em vez de Jest
O NestJS 12 (`@nestjs/cli 12.0.11`) gera projetos **ESM** (`"type": "module"`, `nodenext`) já configurados com Vitest. Jest com ESM exige `--experimental-vm-modules` e transformações extras, e é frágil com decorators. Como a API do Vitest é compatível com a do Jest (`describe`/`it`/`expect`, `globals: true`) e o front também usa Vitest, os dois projetos ficam com um único test runner. O e2e usa Supertest como pedido (`npm run test:e2e`).

### D-003 · ESLint + Prettier no backend, no lugar do oxlint do scaffold
A especificação pede ESLint + Prettier. Usei `typescript-eslint` com `recommendedTypeChecked` e `no-floating-promises: error`, a mesma regra que o oxlint do scaffold aplicava.

### D-004 · Validação de env com Zod
`@nestjs/config` recebe um `validate` baseado em Zod (`src/config/env.schema.ts`). O front também usará Zod (RHF), então a mesma biblioteca serve aos dois lados. Valores vazios (`KEY=`) contam como ausentes. Hoje são obrigatórias `DATABASE_URL` e `FRONTEND_URL`. `JWT_*` passam a ser obrigatórias na fase 3, quando o módulo de auth existir.

### D-005 · Comando da API no Docker
O compose roda `npm run start:docker`. Na fase 1 esse script é só `nest start --watch`. Na fase 3 ele passa a ser `prisma migrate deploy && nest start --watch`, como pede a especificação. Ficou assim porque ainda não existe schema Prisma.

### D-006 · Banco de teste no mesmo container
O script `docker/db/init/01-test-database.sh` cria `lista_esperta_test` na primeira subida do volume. Ele é montado como **arquivo** em `/docker-entrypoint-initdb.d/20-…`, sem esconder o `10_postgis.sh` da imagem. O e2e usa `DATABASE_URL_TEST` ou, na falta dela, `localhost:5433/lista_esperta_test`.

### D-007 · Polling no Docker
`WATCHPACK_POLLING=true` no web e `CHOKIDAR_USEPOLLING=true` no api, como pedido. No api também adicionei `TSC_WATCHFILE=DynamicPriorityPolling`, porque o `nest start --watch` usa o watcher do `tsc`, que ignora o Chokidar. O hot reload pelo bind mount foi testado no Windows.

### D-008 · Escopo fora da especificação
A camada preditiva (Vigil Labs, `lib/forecast`) e os pilares B2B de cashback não estão na nova especificação. Serão removidos quando as telas forem reescritas (fase 2 em diante), exceto o bloco "Patrocinado", que a seção 7 mantém.

### D-009 · `.env.example` do front
Até a fase 3, o front antigo ainda lê `GEMINI_API_KEY` etc. nas rotas `app/api/*`. O `.env.example` do front só passa para o formato da especificação (`NEXT_PUBLIC_*`) quando essas rotas forem removidas, para não quebrar a demo atual no meio do caminho.

### D-010 · `AGENTS.md` do scaffold Nest removido
Ele só divulgava o serviço pago NestJS Observe e não tinha instruções do projeto. O `AGENTS.md` do Next foi mantido, porque é regenerado pelo `next dev` e traz avisos de versão relevantes.
