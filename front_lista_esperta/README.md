# front_lista_esperta

PWA do **Lista Esperta** — foto ou texto da lista de compras → veredito de onde ela sai mais barata perto de você, hoje, contando deslocamento e tempo.

> Estado atual: frontend completo das 3 telas (lista, veredito, painel do lojista) com o motor de veredito real rodando sobre uma **base de preços simulada** do bairro-piloto (Vila Mariana, SP). Banco, Firecrawl, Sefaz e Vigil Labs ainda não estão ligados. Plano completo em [docs/](docs/README.md).

## O que já funciona

| Rota | O que faz | Dados |
|------|-----------|-------|
| `/` | Tela 1: digitar, colar ou fotografar a lista; chips ao vivo com o que foi entendido, "Só {marca}" ↔ "Qualquer marca", raio e modo de deslocamento | Parser local real; foto exige `GEMINI_API_KEY` |
| `/veredito` | Tela 2: 1 ou 2 lojas pelo custo total (produtos + km + tempo), regra de quando vale dividir, selos de procedência, dica preditiva, rota no Google Maps, slot patrocinado separado com "Ver sem anúncios" e código de verificação | Motor real, preços simulados |
| `/lojista` | Tela 3: listas por perto, % de vereditos ganhos, onde a loja perde, demanda por categoria, mapa de calor com k-anonimato (k ≥ 20) | 1.200 listas simuladas |
| `/nota` | Valida a chave da NFC-e (foto do QR Code ou link colado) no aparelho: UF, CNPJ, mês, dígito verificador | Real (a leitura dos itens na Sefaz ainda não está ligada) |
| `/transparencia` | Fórmula, parâmetros e garantias de neutralidade | Lê os parâmetros do código |
| `POST /api/verdict` | Contrato da tool `quote_basket` para agentes: `{ items:[{text, quantity?, brand_required?}], location:{lat,lng}, radius_m?, travel_mode? }` | Motor real |
| `POST /api/lists/parse` | Foto (`multipart`, campo `image`) → linhas via Gemini; ou `{ text }` → linhas | Gemini se houver chave |

A URL do veredito carrega a lista inteira (`/veredito?i=arroz%205kg&i=caf%C3%A9&lat=…&lng=…&r=3000&m=DRIVE`): dá para compartilhar, recarregar e recalcular exatamente o mesmo resultado. Fora da Vila Mariana (ou sem permissão de localização), o ponto de partida é o centro do bairro-piloto e a tela avisa.

## Stack

- **Next.js 16.4** (App Router, Turbopack) · **React 19.3** · **TypeScript 5** · **Tailwind CSS 4**
- `next.config.ts` já habilita `cacheComponents`, `partialPrefetching` e `experimental.agentFeedback`
- Integrações planejadas: Gemini API, Google Maps Platform (Places, Routes, Maps JS), Firecrawl, Vigil Labs, Postgres + PostGIS

## Pré-requisitos

- **Node.js 20.9+** (testado com Node 24) e npm
- Para as fases com backend: PostgreSQL 16 com PostGIS (local via Docker, Cloud SQL ou Supabase)

## Como rodar

```bash
cd front_lista_esperta
npm install
cp .env.example .env.local     # opcional: só GEMINI_API_KEY é usada hoje (leitura de foto)
npm run dev                    # http://localhost:3000
```

Para ver o fluxo completo: abra `/`, toque em **Usar uma lista de exemplo** e em **Ver onde comprar**. Negue a localização (ou esteja fora de SP) para partir do bairro-piloto.

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento com Turbopack e hot reload |
| `npm run build` | Build de produção (também roda checagem de tipos) |
| `npm run start` | Serve o build de produção (rode `build` antes) |
| `npm run lint` | ESLint, incluindo a regra que impede `lib/verdict/` de importar anúncios |
| `npm test` | Vitest: parser da lista, motor (monotonicidade, regra de divisão, determinismo), neutralidade e chave NFC-e |

### Banco local (quando chegar a fase de dados)

```bash
docker run -d --name lista-esperta-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lista_esperta \
  postgis/postgis:16-3.4
# aplique as migrations de db/migrations/ (SQL em docs/01-arquitetura-dados-ingestao.md#14-schema-postgresql--postgis)
```

### Testar como PWA no celular

O service worker e a instalação exigem HTTPS (exceto `localhost`). Para testar no aparelho, use `npm run dev -- --experimental-https` ou um túnel HTTPS e abra o endereço no celular.

## Variáveis de ambiente

Todas listadas em [.env.example](.env.example). Regras:
- Somente variáveis com prefixo `NEXT_PUBLIC_` chegam ao navegador — **a chave server do Maps e as chaves de Gemini/Firecrawl/Vigil nunca podem ter esse prefixo**.
- Hoje o app só lê `GEMINI_API_KEY` e `GEMINI_MODEL_FAST` (padrão: `gemini-flash-latest`). Sem a chave, a foto devolve uma mensagem pedindo para digitar a lista; todo o resto funciona. As demais variáveis são para as próximas fases.

## Estrutura

```
app/
  page.tsx                 Tela 1 — entrada da lista
  veredito/page.tsx        Tela 2 — veredito (Suspense + streaming)
  lojista/page.tsx         Tela 3 — painel do lojista ("use cache")
  nota/  transparencia/    envio de NFC-e, como calculamos
  api/verdict/             tool quote_basket para agentes
  api/lists/parse/         foto/texto → linhas (Gemini)
  manifest.ts, icon.svg    PWA
components/                ListForm, VerdictView, PriceTag, SourceBadge, NfceChecker, SiteHeader
lib/
  verdict/                 NEUTRO: optimize, travel, confidence, hash, build, params
  ads/                     seleção de patrocinados (só lê o veredito pronto)
  forecast/                dica preditiva heurística (interface para Vigil Labs)
  list/                    parser da lista e codec da URL
  demo/                    catálogo, lojas, preços e listas simulados
  ai/gemini.ts             leitura de foto via API REST do Gemini
  nfce.ts                  validação da chave de acesso
docs/                      relatório técnico executivo
```

Para trocar a base simulada pela real, substitua `lib/demo/prices.ts` (`offerAt`, `regionalOffers`) por consultas ao `current_prices` da [Seção 1.4](docs/01-arquitetura-dados-ingestao.md) e `lib/verdict/travel.ts` pela matriz da Routes API. O resto do motor e das telas não muda.

Regra de arquitetura que não pode ser quebrada: **`lib/verdict/` é neutro** — não importa `lib/ads/` nem lê tabelas de anúncio ([Seção 3.6](docs/03-monetizacao-b2b.md#36-como-provar-que-o-ranking-de-menor-preço-nunca-é-vendido)).

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/README.md](docs/README.md) | Sumário executivo e índice |
| [01 — Dados & Ingestão](docs/01-arquitetura-dados-ingestao.md) | Firecrawl, NFC-e, crowd, schema PostGIS, prompts Gemini |
| [02 — Motor de Decisão](docs/02-motor-de-decisao.md) | Custo total, otimizador 1–2 lojas, camada preditiva |
| [03 — Monetização B2B](docs/03-monetizacao-b2b.md) | 4 pilares de receita + prova de neutralidade |
| [04 — UX/UI](docs/04-ux-ui.md) | 3 telas, base fria, selos de confiança, PWA |
| [05 — Roadmap, Riscos & Demo](docs/05-roadmap-mvp-riscos-demo.md) | Stack, checklist, sprint de 4 semanas, demo de 2 min |

## Nota para agentes de código

Esta versão do Next.js tem APIs diferentes das versões antigas. Antes de escrever código, consulte os guias em `node_modules/next/dist/docs/` (ver [AGENTS.md](AGENTS.md)). Guias mais relevantes aqui: `01-app/02-guides/progressive-web-apps.md`, `offline-support.md` e `01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`.
