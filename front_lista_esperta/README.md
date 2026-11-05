# front_lista_esperta

PWA da **Lista Esperta** em Next.js 16 (App Router, Cache Components, Tailwind v4). O setup completo, com Docker e com o backend, está no [README da raiz](../README.md).

> Estado: todas as telas usam a API Nest com dados reais (fase 7). O protótipo do hackathon e os dados simulados (`lib/demo/`) foram removidos.

## Rotas

| Rota | Grupo | O que é |
|---|---|---|
| `/` | `(shopper)` | Montar a lista: texto livre com quantidade ("2 leite"), autocompletar do catálogo, colar várias linhas ou foto da lista (Gemini, pela API). Salva no aparelho ou na conta |
| `/verdict` | `(shopper)` | Veredito pela API: a loja de menor custo total (itens + deslocamento), divisão em duas lojas quando compensa, a origem de cada preço, itens sem preço e o bloco "Patrocinado" separado. Raio, R$/km e valor da hora ajustáveis na tela |
| `/receipts/import` | `(shopper)` | Enviar NFC-e: QR Code pela câmera, link, foto ou chave digitada |
| `/stores` | `(shopper)` | Lojas por perto: mapa (MapLibre + OpenFreeMap) e lista por distância, sem login |
| `/how-it-works` | `(shopper)` | Fórmula, parâmetros e neutralidade |
| `/offline` | `(shopper)` | Página servida pelo service worker sem conexão |
| `/login`, `/register` | `(auth)` | Entrar e criar conta ("Quero economizar" / "Tenho uma loja") |
| `/account` | `(shopper)` | Minha conta: nome, custo por km, valor da hora, raio padrão, sair. Exige login |
| `/merchant` | `merchant/` | Lojas do lojista. Exige conta de lojista ou admin |
| `/merchant/stores/[storeId]` | `merchant/` | Painel da loja: visão geral, produtos e preços, importar planilha, equipe, fotos e CNPJ |
| `/merchant/onboarding` | `merchant/` | Encontrar a loja no mapa e pedir para administrá-la, ou cadastrá-la (pin, horários, categorias, CNPJ) |

O `proxy.ts` protege `/merchant`, `/admin` e `/account` consultando `GET /api/v1/auth/me` (ver `docs/DECISIONS.md`, D-023).

**Dados:** o front só fala com a API pelo client tipado em `lib/api/` (`openapi-fetch` + tipos gerados com `npm run api:types`), sempre com `credentials: "include"` e com renovação automática da sessão em caso de 401. As listas passam pelo `ShoppingListRepository`: IndexedDB para visitantes e API para quem tem conta. Ao entrar ou criar conta, as listas do aparelho vão para a conta (`lib/shopping-lists/migrate.ts`).

As rotas antigas (`/veredito`, `/nota`, `/lojista`, `/transparencia`) redirecionam para as novas (`next.config.ts`).

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (http://localhost:3000) |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint (inclui a regra de neutralidade: os componentes do ranking em `components/verdict/` não podem importar o `SponsoredBlock`) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest: lógica em `lib/` e componentes com Testing Library (jsdom) |
| `npm run format` / `format:check` | Prettier, com ordenação de classes do Tailwind |

## Design system

- **Tokens:** `app/globals.css`, com a origem e os contrastes documentados em [`docs/BRAND.md`](../docs/BRAND.md). Cada cor é definida uma vez com `light-dark()`. O tema segue o aparelho, e o botão do cabeçalho força claro ou escuro (`<html data-theme>`, salvo em `localStorage` e aplicado antes da primeira pintura).
- **Componentes base** em `components/ui/`: `Button` / `buttonClasses` (também para `<Link>`), `TextField`, `TextAreaField`, `Badge`, `Notice`, `Skeleton`, `Spinner` e `PageHeading`. Todo alvo de toque tem no mínimo 44 px (`min-h-tap` / `size-tap`).
- **Shell:** `components/layout/` tem `AppHeader`, `HeaderNav` (tablet e desktop), `TabBar` (celular), `SiteFooter` e `SkipLink`.
- **A etiqueta de preço amarela** (`PriceTag`, `.price-tag`) é o único elemento chamativo da interface. O amarelo do pin não aparece em outros lugares.

## Mapa

MapLibre GL 6 com tiles gratuitos do OpenFreeMap (sem chave). O worker do MapLibre é copiado para `public/vendor/maplibre/` no `postinstall` (`scripts/copy-maplibre-worker.mjs`) e carregado por `components/map/load-maplibre.ts` (ver `docs/DECISIONS.md` D-037). A lista de lojas é a forma acessível de navegar; o mapa é complementar.

## PWA

- `app/manifest.ts`, com ícones gerados a partir do logo em `public/icons/` (192, 512, maskable e apple-touch). Os arquivos de logo originais não são alterados.
- `public/sw.js`: páginas com *network first* e fallback para o cache e depois para `/offline`; `/_next/static` com *cache first*. A API (outra origem) nunca passa pelo cache.
- O service worker **só é registrado no build de produção**. Para testar: `npm run build && npm start`, e veja em DevTools → Application. Para registrar em dev, use `NEXT_PUBLIC_ENABLE_SW_IN_DEV=true`.
- `experimental.useOffline` mostra o aviso "Sem internet" e repete as navegações quando a conexão volta.
- Para instalar no celular é preciso HTTPS (exceto em `localhost`): `npm run dev -- --experimental-https` ou um túnel.

## Variáveis de ambiente

Ver [.env.example](.env.example). Só variáveis `NEXT_PUBLIC_*` chegam ao navegador. O front não guarda nenhuma chave de serviço: Gemini, OpenRouteService e as outras integrações ficam só na API.

## Nota para agentes de código

Esta versão do Next.js tem APIs diferentes das antigas: consulte `node_modules/next/dist/docs/` antes de escrever código (ver [AGENTS.md](AGENTS.md)). Por exemplo, o `middleware.ts` virou `proxy.ts`.

A documentação do protótipo (relatório do hackathon) continua em [docs/](docs/README.md), como registro histórico.
