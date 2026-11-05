# Auditoria do repositório (antes da refatoração)

Data: 2026-11-04 · Branch: `develop` · Último commit: `dd76ec6 Feat: logo, icones e novas cores`

## Estrutura atual

```
/
├── README.md                      ← visão do produto (hackathon hack.br)
└── front_lista_esperta/           ← Next.js 16.4.4 (App Router) + React 19.3, PWA e BFF
    ├── app/
    │   ├── page.tsx               ← home: formulário da lista
    │   ├── veredito/              ← tela do veredito
    │   ├── nota/                  ← envio de NFC-e (chave de 44 dígitos)
    │   ├── lojista/               ← painel do lojista (dados simulados)
    │   ├── transparencia/         ← página sobre neutralidade e fontes
    │   ├── api/verdict/route.ts   ← BFF: calcula o veredito no servidor Next
    │   ├── api/lists/parse/route.ts ← BFF: chama o Gemini com GEMINI_API_KEY
    │   ├── manifest.ts            ← manifest PWA (sem service worker)
    │   └── globals.css            ← tokens de cor (Tailwind v4, @theme inline)
    ├── components/                ← ListForm, NfceChecker, PriceTag, SiteHeader, SourceBadge, verdict/VerdictView
    ├── lib/
    │   ├── verdict/               ← motor de decisão (build, optimize, travel, confidence, params, hash)
    │   ├── list/                  ← parsing de texto da lista e query string
    │   ├── nfce.ts                ← validação da chave de 44 dígitos (DV módulo 11)
    │   ├── ai/gemini.ts           ← cliente Gemini (lado servidor do Next)
    │   ├── ads/select.ts          ← seleção de patrocinados, fora do ranking
    │   ├── forecast/heuristic.ts  ← dica preditiva (Vigil Labs / heurística)
    │   └── demo/                  ← catálogo, lojas, preços e insights simulados (Vila Mariana, SP)
    ├── docs/                      ← relatório técnico do hackathon (5 capítulos, pt-BR)
    └── public/                    ← logo_lista_esperta.webp, icon_lista_esperta.ico
```

O Next **já está em `front_lista_esperta/`**, então não é preciso mover nada. Ainda não existem backend, banco, Docker nem `docs/` na raiz.

## Dependências

- Runtime: `next 16.4.4`, `react 19.3.0`, `react-dom 19.3.0`. Não há outras bibliotecas: sem TanStack Query, RHF, Zod, IndexedDB ou leitor de QR.
- Dev: Tailwind v4 (`@tailwindcss/turbopack`), ESLint 9 (`eslint-config-next`), TypeScript 5 (`strict: true`), Vitest 5.
- `next.config.ts`: `cacheComponents`, `partialPrefetching` e `experimental.agentFeedback`.
- Ambiente local: Node 24.19, npm 11.17, Docker 29.9 e Compose v5.6 (Windows + Docker Desktop).

## O que funciona hoje

| Verificação | Resultado |
|---|---|
| `npm run lint` | ✅ sem erros |
| `npx tsc --noEmit` | ✅ sem erros (não existe script `typecheck`) |
| `npm test` | ✅ 3 arquivos, 19 testes (`verdict`, `nfce`, `list/parse`) |

- Fluxo lista → veredito → painel do lojista, todo sobre **dados simulados** em `lib/demo/`.
- O motor de veredito já calcula custo total, divisão em duas lojas e confiança, e tem teste de neutralidade (anúncios não alteram o ranking). Uma regra de ESLint impede `lib/verdict` de importar `lib/ads`.
- Validação do DV da chave NFC-e, com testes.
- Leitura de lista por foto via Gemini (só com `GEMINI_API_KEY`), feita **no servidor Next**.

## Divergências com a nova especificação

| Tema | Hoje | Alvo |
|---|---|---|
| Backend | BFF em rotas `app/api/*` do Next | API NestJS separada em `back_lista_esperta/` |
| Segredos | `GEMINI_API_KEY` e `GOOGLE_MAPS_SERVER_KEY` lidos pelo Next | Só no backend; o front só tem `NEXT_PUBLIC_*` |
| Banco | nenhum (o `.env.example` cita Cloud SQL/Supabase) | PostgreSQL + PostGIS em Docker, Prisma |
| Auth | nenhuma | JWT em cookies httpOnly no Nest; guest sem conta |
| Rotas | nomes em português (`/veredito`, `/lojista`, `/nota`) | código em inglês: `(shopper)`, `(auth)`, `account/`, `merchant/`, `admin/` |
| Listas | estado em memória / query string | `ShoppingListRepository` (IndexedDB para guest, API para logado) |
| PWA | só manifest | manifest + service worker + offline da última lista e veredito |
| Domínio | supermercado (catálogo de alimentos) | qualquer comércio físico, categorias hierárquicas |
| Predição | Vigil Labs / heurística (`lib/forecast`) | fora da especificação (ver `DECISIONS.md`) |
| Scripts | sem `typecheck`, sem Prettier | `lint`, `typecheck` e `test` nos dois projetos |

## O que vale reaproveitar

- **Tokens de cor** de `globals.css`: já derivados do logo, com modo claro e escuro (ver `BRAND.md`).
- **Algoritmo do veredito** (`lib/verdict/optimize.ts`, `travel.ts`, `confidence.ts`) e seus testes, como referência ao portar para o módulo `verdict` do Nest.
- **Validação da chave NFC-e** (`lib/nfce.ts`) e seus testes, para portar para `receipts/`.
- **Componentes visuais** `PriceTag` e `SourceBadge`, além da identidade "etiqueta de gôndola".
- Os demais itens (rotas, `lib/demo`, BFF) serão substituídos.

## Riscos observados

- O `AGENTS.md` avisa que o Next 16.4 tem APIs diferentes das conhecidas. Antes de mexer no front, é preciso consultar `node_modules/next/dist/docs/`.
- `cacheComponents: true` muda a semântica de dados dinâmicos (cookies/sessão) no middleware e nas páginas. Isso precisa ser validado na fase 3.
- `public/icon_lista_esperta.ico` é um PNG 256×256 dentro de um ICO. Para o manifest do PWA faltam ícones PNG 192/512 e *maskable*. Eles devem ser **gerados como novos arquivos**, sem alterar os originais.
