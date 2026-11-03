# Seção 4 — UX/UI & Redução Drástica de Atrito (Material You)

> Princípio: **uma ação, uma resposta**. O usuário fotografa ou cola a lista e recebe um veredito. Tudo o mais é opcional e fica abaixo da dobra.

## 4.1 Princípios de design

| Princípio | Aplicação concreta |
|-----------|--------------------|
| Zero cadastro antes do valor | Primeiro veredito sem login. Login (Firebase Auth / Google One Tap) só para salvar lista, cashback ou alerta. |
| Permissão no contexto | Geolocalização pedida **ao tocar em "Ver onde comprar"**, com explicação de 1 linha; fallback: digitar CEP/bairro. |
| Uma decisão por tela | Tela 2 tem **um** botão primário ("Abrir rota"). |
| Números honestos | Todo preço com fonte + idade; estimativas visualmente distintas de preços confirmados. |
| Material You / M3 | Tokens de cor dinâmicos (seed verde-economia), tipografia M3 (Display/Headline/Body), *shape* arredondado, componentes: FAB, Cards, Chips, Bottom Sheet, Snackbar. Tema claro/escuro via `prefers-color-scheme`. |
| Acessibilidade | Contraste AA, alvos ≥ 48 dp, números com `aria-label` por extenso ("duzentos e oitenta e sete reais e noventa centavos"), sem informação só por cor. |
| Performance como UX | Shell do app pré-renderizado (Cache Components + Partial Prefetching já ligados no `next.config.ts`); veredito chega por streaming com *skeleton* honesto ("Comparando 38 itens em 9 mercados…"). |

---

## 4.2 Jornada em 3 telas

### Tela 1 — Entrada da Lista (`/`)

```
┌─────────────────────────────────┐
│  Lista Esperta          [perfil]│
│                                 │
│  Onde sua lista sai             │
│  mais barata hoje?              │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ arroz 5kg, feijão, leite... │ │  ← textarea (aceita colar do WhatsApp)
│ └─────────────────────────────┘ │
│                                 │
│  [📷 Foto da lista] [🎤 Falar]  │  ← chips de entrada multimodal
│                                 │
│  Raio: ●──────○ 3 km   🚗 Carro │  ← defaults; editáveis sem sair da tela
│                                 │
│  ┌───────────────────────────┐  │
│  │   Ver onde comprar  →     │  │  ← único CTA primário
│  └───────────────────────────┘  │
│  [ Escanear nota fiscal ]       │  ← secundário (alimenta a base)
└─────────────────────────────────┘
```

- **Foto:** `<input type="file" accept="image/*" capture="environment">` → redimensiona no cliente (≤ 1600 px, JPEG 0,8) → `POST /api/lists/parse` (Gemini Prompt 1 da Seção 1.5).
- **Revisão inline:** a lista parseada aparece como **chips editáveis** ("Leite integral ×2", "Arroz 5 kg") antes do cálculo; chips de baixa confiança vêm com borda tracejada e "Quis dizer…?". Um toque corrige.
- **Marca:** chip com cadeado 🔒 = marca exigida; sem cadeado = aceita equivalente mais barato. Alternar com 1 toque.

### Tela 2 — O Veredito (`/veredito/[id]`)

```
┌─────────────────────────────────┐
│ ← Sua lista · 38 itens          │
│                                 │
│  VÁ AO                          │
│  Assaí Vila Mariana             │  ← Display
│  + Sacolão Rua 7                │
│                                 │
│  R$ 303,24  custo total         │
│  economiza R$ 17,86 vs. só Assaí│
│  🚗 5,4 km · 19 min             │
│                                 │
│  ● Confiança alta               │
│    31/38 confirmados hoje  ⓘ    │
│                                 │
│  ┌───────────────────────────┐  │
│  │      Abrir rota  →        │  │  ← deep link Google Maps com waypoints
│  └───────────────────────────┘  │
│                                 │
│  💡 Carne baixa às quartas      │  ← no máx. 1 dica (Vigil), chip "Lembrar"
│     −R$ 6,40 · [Lembrar quarta] │
│                                 │
│  ▾ O que comprar em cada loja   │  ← accordion por loja, itens com selo
│  ▾ Por que não só uma loja?     │  ← explicação do custo (km, tempo, parada)
│  ─────────── Patrocinado ────── │
│  Oferta: Café Pilão R$ 14,90    │  ← slot rotulado, separado (Seção 3.6)
└─────────────────────────────────┘
```

- **Hierarquia:** loja(s) → custo total → economia → confiança → ação. O usuário que só lê a primeira linha já sabe o que fazer.
- **Abrir rota:** `https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...&travelmode=driving` — sem SDK nativo, funciona em qualquer celular.
- **"Por que não só uma loja?"** mostra a conta da Seção 2.1 em linguagem humana: *"Ir também ao Sacolão adiciona 1,8 km e ~12 min, mas os 11 itens de hortifrúti saem R$ 29 mais baratos."*
- **Mapa** (Maps JavaScript API) em *bottom sheet* expansível, não na primeira dobra — economiza custo de API e atenção.

### Tela 3 — Visão do Lojista (`/lojista`)

```
┌─────────────────────────────────────────────────┐
│ Sacolão Rua 7 · Painel                     [⚙]  │
│                                                 │
│  Esta semana no seu raio de 2 km                │
│  ┌─────────┐ ┌─────────┐ ┌──────────────────┐   │
│  │ 1.240   │ │  18 %   │ │ R$ 2,10          │   │
│  │ listas  │ │ vereditos│ │ gap no arroz 5kg │   │
│  │ c/ carne│ │ ganhos  │ │ vs. concorrente  │   │
│  └─────────┘ └─────────┘ └──────────────────┘   │
│                                                 │
│  Onde você perde (top 5 itens)                  │
│  arroz 5kg   R$ 27,90 vs R$ 25,80   [Ajustar]   │
│  ...                                            │
│                                                 │
│  Mapa de calor de intenção (H3, k ≥ 20)         │
│                                                 │
│  [ Criar campanha de oferta local ]             │
└─────────────────────────────────────────────────┘
```

- KPIs em *stat tiles*; mapa de calor de células H3 agregadas (nunca pontos individuais).
- **"Ajustar"** leva a publicar novo preço (vira observação `source='site'` com confiança moderada até ser confirmada por NFC-e).
- Na demo, esta tela prova o lado B2B em 15 segundos.

---

## 4.3 Base fria / vazia no dia 1

O pior momento do produto é um usuário em um bairro sem dados. Estratégia em 4 camadas:

1. **Semear antes de abrir (supply-first):** escolher **1 bairro-piloto** (o da demo), cadastrar as ~15 lojas via Places Nearby Search, ingerir encartes via Firecrawl e escanear **100–200 NFC-e** do time/amigos nas 2 semanas anteriores. Melhor 1 bairro denso que uma cidade rala.
2. **Baseline regional:** quando a loja não tem preço do item, usar a mediana regional (raio 10 km) como **estimativa**, sempre marcada como tal.
3. **Veredito degradado, mas honesto:** se < 60 % dos itens tiverem preço confirmado no raio, a Tela 2 muda o título de "Vá ao X" para *"Provavelmente mais barato: X"* e mostra o CTA *"Ajude a confirmar: escaneie sua nota depois da compra"*.
4. **Loop de contribuição com recompensa imediata:** após escanear uma nota, *"Você atualizou 23 preços que ajudam 412 vizinhos 💚"* + elegibilidade a cashback. A contribuição é o próprio ato pós-compra que o cashback já incentiva.

**Fora do bairro-piloto:** mensagem clara — *"Ainda estamos chegando no seu bairro. Escaneie uma nota para colocar seu mercado no mapa."* — em vez de um veredito ruim.

## 4.4 Comunicando a confiança do dado

Cada preço carrega um **selo de procedência** derivado de `current_prices`:

| Selo | Regra | Exemplo de texto |
|------|-------|------------------|
| 🟢 Confirmado | NFC-e ou ≥ 3 confirmações nas últimas 24 h | "Pago por 4 pessoas · há 1 h" |
| 🟡 Anunciado | Encarte válido, sem NFC-e recente | "Encarte · válido até sáb" |
| 🟠 Comunidade | 1–2 relatos crowd < 24 h | "Visto por 1 pessoa · há 3 h" |
| ⚪ Estimado | Sem dado na loja; mediana regional | "Estimativa da região" (itálico, cinza) |

```ts
// lib/verdict/confidence.ts
export function badge(cp: CurrentPrice): Badge {
  const hours = (Date.now() - cp.observedAt.getTime()) / 36e5;
  if (cp.source === "nfce" || cp.observations24h >= 3) return { tone: "confirmed", text: `Pago por ${cp.observations24h || 1} pessoa(s) · ${rel(hours)}` };
  if (cp.source === "encarte") return { tone: "advertised", text: `Encarte · ${validity(cp)}` };
  if (cp.source === "crowd")   return { tone: "community", text: `Visto por ${cp.observations24h} pessoa(s) · ${rel(hours)}` };
  return { tone: "estimated", text: "Estimativa da região" };
}
```

**Confiança agregada do veredito** (o "● Confiança alta"):

```
score = Σ (subtotal_item × confiança_item) / Σ subtotal_item      (ponderada pelo peso do item na cesta)
alta ≥ 0,80 · média 0,60–0,80 · baixa < 0,60
```

Ponderar pelo valor evita que 10 itens baratos confirmados escondam que a carne (40 % da cesta) é estimativa.

## 4.5 PWA

- `app/manifest.ts` (convenção nativa do Next 16 — ver `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`), `display: "standalone"`, ícones 192/512 e *maskable*.
- **Web Push** para "Lembrar quarta" e alertas de preço (iOS 16.4+ quando instalado na tela inicial).
- **Offline:** a última lista e o último veredito ficam disponíveis; o flag experimental `useOffline` do Next 16 (ver `offline-support.md` nos docs locais) segura navegações/Server Actions até a conexão voltar.
- **Prompt de instalação** só depois do primeiro veredito útil (nunca no primeiro acesso).
