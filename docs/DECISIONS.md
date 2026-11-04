# Decisões

Registro de decisões tomadas onde a especificação era ambígua ou conflitava com o ambiente. A mais recente fica no topo de cada fase.

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
