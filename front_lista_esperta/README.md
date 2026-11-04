# front_lista_esperta

PWA da **Lista Esperta** em Next.js 16 (App Router, Cache Components, Tailwind v4). O setup completo, com Docker e com o backend, está no [README da raiz](../README.md).

> Estado: a base visual e o PWA são definitivos (fase 2). As telas de lista, veredito, NFC-e e lojista ainda são o **protótipo do hackathon**, com preços simulados em `lib/demo/`. Elas serão reescritas sobre a API Nest nas fases 3 a 7.

## Rotas

| Rota | Grupo | O que é |
|---|---|---|
| `/` | `(shopper)` | Montar a lista (protótipo) |
| `/verdict` | `(shopper)` | Veredito: 1 ou 2 lojas pelo custo total (protótipo, motor real sobre preços simulados) |
| `/receipts/import` | `(shopper)` | Validação da chave da NFC-e no aparelho (protótipo) |
| `/how-it-works` | `(shopper)` | Fórmula, parâmetros e neutralidade |
| `/offline` | `(shopper)` | Página servida pelo service worker sem conexão |
| `/merchant` | `merchant/` | Painel do lojista (protótipo; protegido por login a partir da fase 3) |

As rotas antigas (`/veredito`, `/nota`, `/lojista`, `/transparencia`) redirecionam para as novas (`next.config.ts`).

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (http://localhost:3000) |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint (inclui a regra que impede `lib/verdict/` de importar anúncios) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest: lógica em `lib/` e componentes com Testing Library (jsdom) |
| `npm run format` / `format:check` | Prettier, com ordenação de classes do Tailwind |

## Design system

- **Tokens:** `app/globals.css`, com a origem e os contrastes documentados em [`docs/BRAND.md`](../docs/BRAND.md). Cada cor é definida uma vez com `light-dark()`. O tema segue o aparelho, e o botão do cabeçalho força claro ou escuro (`<html data-theme>`, salvo em `localStorage` e aplicado antes da primeira pintura).
- **Componentes base** em `components/ui/`: `Button` / `buttonClasses` (também para `<Link>`), `TextField`, `TextAreaField`, `Badge`, `Notice`, `Skeleton`, `Spinner` e `PageHeading`. Todo alvo de toque tem no mínimo 44 px (`min-h-tap` / `size-tap`).
- **Shell:** `components/layout/` tem `AppHeader`, `HeaderNav` (tablet e desktop), `TabBar` (celular), `SiteFooter` e `SkipLink`.
- **A etiqueta de preço amarela** (`PriceTag`, `.price-tag`) é o único elemento chamativo da interface. O amarelo do pin não aparece em outros lugares.

## PWA

- `app/manifest.ts`, com ícones gerados a partir do logo em `public/icons/` (192, 512, maskable e apple-touch). Os arquivos de logo originais não são alterados.
- `public/sw.js`: páginas com *network first* e fallback para o cache e depois para `/offline`; `/_next/static` com *cache first*. A API (outra origem) nunca passa pelo cache.
- O service worker **só é registrado no build de produção**. Para testar: `npm run build && npm start`, e veja em DevTools → Application. Para registrar em dev, use `NEXT_PUBLIC_ENABLE_SW_IN_DEV=true`.
- `experimental.useOffline` mostra o aviso "Sem internet" e repete as navegações quando a conexão volta.
- Para instalar no celular é preciso HTTPS (exceto em `localhost`): `npm run dev -- --experimental-https` ou um túnel.

## Variáveis de ambiente

Ver [.env.example](.env.example). Só variáveis `NEXT_PUBLIC_*` chegam ao navegador. As rotas `app/api/*` do protótipo ainda leem `GEMINI_API_KEY` e serão removidas quando a API Nest assumir essas funções (ver `docs/DECISIONS.md`, D-009).

## Nota para agentes de código

Esta versão do Next.js tem APIs diferentes das antigas: consulte `node_modules/next/dist/docs/` antes de escrever código (ver [AGENTS.md](AGENTS.md)). Por exemplo, o `middleware.ts` virou `proxy.ts`.

A documentação do protótipo (relatório do hackathon) está em [docs/](docs/README.md).
