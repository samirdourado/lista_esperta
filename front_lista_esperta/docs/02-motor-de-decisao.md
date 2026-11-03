# Seção 2 — Motor de Decisão & Algoritmo de Veredito (Atacado vs. Varejo)

> Objetivo: dado `lista + posição + raio + perfil de deslocamento`, devolver **um veredito** (1 loja ou 2 lojas) com o custo total, a economia e o grau de confiança — em < 1,5 s.

## 2.1 Função de custo total

$$
\text{CustoTotal}(P) = \underbrace{\sum_{i \in L} q_i \cdot p_{i,\,s(i)}}_{\text{cesta}}
+ \underbrace{d_P \cdot c_{km}}_{\text{deslocamento}}
+ \underbrace{(t_P + n_P \cdot t_{parada}) \cdot v_{min}}_{\text{tempo}}
+ \underbrace{\sum_{i \notin \text{cobertos}} \text{pen}_i}_{\text{incerteza}}
$$

| Símbolo | Significado | Fonte | Default (hipótese) |
|---------|-------------|-------|--------------------|
| `P` | Plano: conjunto ordenado de 1 ou 2 lojas + atribuição item→loja | otimizador | — |
| `q_i`, `p_{i,s}` | Quantidade e preço do item `i` na loja `s` (respeitando `min_qty`) | `current_prices` | — |
| `d_P`, `t_P` | km e minutos do circuito **casa → lojas → casa** | Routes API (`computeRouteMatrix`) | — |
| `c_km` | Custo por km | perfil do usuário | carro: **R$ 0,85/km** (combustível ÷ 10 km/l + desgaste); a pé/bike: 0; ônibus: tarifa fixa por trecho |
| `v_min` | Valor do tempo | perfil (slider "meu tempo vale") | **R$ 0,25/min** (R$ 15/h) |
| `t_parada` | Overhead por loja (estacionar, fila, caixa) | constante calibrável | **12 min** |
| `pen_i` | Penalidade de item não encontrado/incerto | mediana regional × fator | `p75 regional × 1,15` |

**Por que o `t_parada` importa:** é ele que impede o algoritmo de mandar o usuário a 3 lojas para economizar R$ 4. Com os defaults, uma loja extra "custa" ≥ R$ 3 de tempo antes de qualquer km.

**Por que penalidade e não exclusão:** uma loja que não tem 2 de 40 itens ainda pode ser a melhor; a penalidade estima o custo de comprar esses itens "em algum lugar" e o veredito avisa: *"2 itens sem preço confirmado nesta loja"*.

### Ajuste por confiança

O preço usado na otimização é o **preço esperado ajustado por risco**:

```
p_ajustado = p_observado × (1 + λ × (1 − confiança))      λ = 0,10
```

Um preço de encarte velho e não confirmado fica levemente "mais caro" que um preço de NFC-e de 2 h atrás. Isso evita que o veredito dependa de dados fracos sem descartá-los.

---

## 2.2 Otimizador: 1 loja ou 2 lojas

Com `K` lojas candidatas no raio, avaliar todos os planos de 1 e 2 lojas custa `K + K(K−1)/2` avaliações. Com **pré-filtro para K = 10** (por cobertura × preço) são 55 planos — trivial em memória (< 5 ms). Três lojas raramente compensam o `t_parada` e explodem a carga cognitiva; ficam fora do MVP.

Para um plano de 2 lojas, a atribuição ótima de cada item é **gulosa e exata**: cada item vai para a loja mais barata entre as duas (o custo de rota não depende da atribuição, só do par de lojas).

```ts
// lib/verdict/optimize.ts — função PURA (sem I/O, sem acesso a anúncios; ver Seção 3.6)
export type Profile = { costPerKm: number; valuePerMin: number; stopOverheadMin: number };
export type Offer   = { price: number; minQty: number; confidence: number };
export type Item    = { id: string; qty: number; fallbackPrice: number };
export type Matrix  = Map<string /*storeId*/, Map<string /*itemId*/, Offer>>;
export type Travel  = (storeIds: string[]) => { km: number; minutes: number }; // circuito casa→...→casa

const LAMBDA = 0.10;

function itemCost(item: Item, offer: Offer | undefined) {
  if (!offer || item.qty < offer.minQty) return { cost: item.fallbackPrice * item.qty, covered: false };
  const adj = offer.price * (1 + LAMBDA * (1 - offer.confidence));
  return { cost: adj * item.qty, covered: true };
}

export function evaluate(stores: string[], items: Item[], m: Matrix, travel: Travel, pr: Profile) {
  let basket = 0, missing = 0;
  const assignment: Record<string, string | null> = {};
  for (const it of items) {
    let best = { cost: Infinity, covered: false, store: null as string | null };
    for (const s of stores) {
      const c = itemCost(it, m.get(s)?.get(it.id));
      // Preferir item coberto; entre cobertos, o mais barato
      if ((c.covered && !best.covered) || (c.covered === best.covered && c.cost < best.cost)) {
        best = { ...c, store: c.covered ? s : null };
      }
    }
    basket += best.cost;
    if (!best.covered) missing++;
    assignment[it.id] = best.store;
  }
  const { km, minutes } = travel(stores);
  const travelCost = km * pr.costPerKm;
  const timeCost = (minutes + stores.length * pr.stopOverheadMin) * pr.valuePerMin;
  return { stores, assignment, basket, travelCost, timeCost, missing, total: basket + travelCost + timeCost };
}

export function optimize(candidates: string[], items: Item[], m: Matrix, travel: Travel, pr: Profile) {
  const singles = candidates.map((s) => evaluate([s], items, m, travel, pr));
  const pairs = candidates.flatMap((a, i) =>
    candidates.slice(i + 1).map((b) => evaluate([a, b], items, m, travel, pr)),
  );
  const bestSingle = minBy(singles, (p) => p.total);
  const bestPair   = minBy(pairs,   (p) => p.total);
  return chooseVerdict(bestSingle, bestPair);
}
```

### Regra de histerese: quando recomendar a divisão

Mesmo que o par seja matematicamente mais barato, só recomendamos dividir se a economia **líquida** (já descontados km e tempo) superar um limiar:

```ts
const SPLIT_MIN_ABS = 10;    // R$  (hipótese)
const SPLIT_MIN_PCT = 0.04;  // 4 % da cesta

function chooseVerdict(single: Plan, pair: Plan | undefined): Verdict {
  if (!pair) return { primary: single };
  const saving = single.total - pair.total;
  const threshold = Math.max(SPLIT_MIN_ABS, SPLIT_MIN_PCT * single.basket);
  return saving >= threshold
    ? { primary: pair, alternative: single, splitSaving: saving }
    : { primary: single, alternative: pair, splitSaving: saving };   // mostra "dividir economizaria só R$ X"
}
```

Mostrar o "não vale a pena dividir (só R$ 3,20)" é tão valioso quanto mostrar a divisão: prova que o app respeita o tempo do usuário.

### Pré-filtro de candidatas (K = 10)

1. Todas as lojas no raio (query da Seção 1.4).
2. Score rápido `cobertura × (1 / custo da cesta coberta normalizado)` e distância em linha reta.
3. Garantir **diversidade de formato**: no mínimo 2 atacarejos e 2 varejos/hortifrútis entre as 10 (senão a recomendação híbrida nunca aparece).
4. Routes API `computeRouteMatrix` só para as 10 finalistas: origem + 10 lojas ⇒ matriz 11 × 11 = 121 elementos, cacheada por (célula H3 da origem, modo, hora cheia). O circuito de 2 lojas usa a melhor ordem entre `casa→A→B→casa` e `casa→B→A→casa`.

> **Custo de Maps:** cada matriz é cobrada por elemento. Cache por célula H3 res. 9 (~0,1 km²) + hora reduz drasticamente as chamadas na demo e em produção. No MVP, para economizar, use Routes só para as 10 finalistas e distância geodésica × 1,3 (fator de sinuosidade) no pré-filtro.

### A afinidade de categoria (atacado vs. bairro)

`categories.split_affinity` **não altera o custo** (o ranking é por preço), mas é usada para:
- **Explicar** a divisão: *"Secos e limpeza no Assaí; hortifrúti e carne no Sacolão da Vila."*
- **Desempate** quando dois planos estão dentro de R$ 1.
- **Sugestão de perfil** (opt-in): "Prefiro hortifrúti de bairro" adiciona um bônus explícito e visível ao usuário — nunca oculto.

---

## 2.3 Formato do veredito (contrato da API)

```json
{
  "verdict_id": "vrd_01JC9M4E7Q",
  "algo_version": "2026.11.0",
  "ranking_hash": "sha256:4b1f…",
  "generated_at": "2026-11-03T14:05:12-03:00",
  "primary": {
    "type": "split",
    "stores": [
      { "store_id": "st_assai_vila", "name": "Assaí Vila Mariana", "format": "atacarejo", "items": 27, "subtotal": 241.80 },
      { "store_id": "st_sacolao_rua7", "name": "Sacolão Rua 7", "format": "hortifruti", "items": 11, "subtotal": 46.10 }
    ],
    "basket": 287.90,
    "travel": { "km": 5.4, "minutes": 19, "cost": 4.59, "mode": "DRIVE" },
    "time_cost": 10.75,
    "total": 303.24,
    "missing_items": 2
  },
  "alternative": { "type": "single", "total": 321.10, "label": "Tudo no Assaí" },
  "split_saving": 17.86,
  "confidence": { "level": "alta", "score": 0.84, "explain": "31 de 38 itens confirmados nas últimas 24 h" },
  "tip": {
    "kind": "wait",
    "item": "Contrafilé (kg)",
    "message": "Carne costuma baixar às quartas neste bairro: −R$ 6,40 estimado",
    "confidence": 0.72,
    "provider": "vigil"
  },
  "sponsored": []
}
```

- `ranking_hash` = SHA-256 de `(algo_version, inputs canônicos, primary, alternative)` — a base da prova de neutralidade (Seção 3.6).
- `sponsored` é sempre um campo **separado**; o front nunca o mistura com `primary`/`alternative`.

---

## 2.4 Camada preditiva (Vigil Labs) sem fricção

**Regra de ouro:** a predição **nunca muda o veredito de hoje**. Ela aparece como, no máximo, **uma dica** opcional abaixo do resultado. O usuário que só quer comprar agora não precisa pensar.

### Adapter

```ts
// lib/forecast/provider.ts — o provedor é intercambiável (Vigil Labs, heurística local, mock da demo)
export interface PriceForecastProvider {
  forecast(req: {
    productIds: string[];
    region: string;            // célula H3 res. 7
    horizonDays: number;       // 7
  }): Promise<Array<{
    productId: string;
    bestDay: string;           // ISO date
    expectedChangePct: number; // −0.12 = 12 % mais barato
    confidence: number;        // 0..1
  }>>;
}
```

> Os nomes de endpoints e campos da Vigil Labs devem ser mapeados para essa interface a partir da documentação/credenciais do patrocinador no evento. Enquanto isso, o `HeuristicForecastProvider` (abaixo) e um `MockForecastProvider` permitem desenvolver e demonstrar.

### Filtro de exibição (anti-fricção)

```ts
function pickTip(forecasts: Forecast[], verdict: Verdict, items: Item[]): Tip | null {
  const candidates = forecasts
    .filter((f) => f.confidence >= 0.7)
    .filter((f) => !items.find((i) => i.id === f.productId)?.urgent)   // usuário marcou "preciso hoje"? não sugere esperar
    .map((f) => ({ f, saving: estimatedSaving(f, verdict) }))
    .filter(({ saving }) => saving >= 5)                                // R$ 5 mínimo (hipótese)
    .sort((a, b) => b.saving - a.saving);
  return candidates[0] ? toTip(candidates[0]) : null;                   // NO MÁXIMO 1 dica
}
```

**Apresentação:** um *chip* com ação de 1 toque — *"Lembrar quarta"* (agenda push via Web Push no PWA) — e o item sai da lista de hoje se o usuário aceitar, recalculando o veredito.

### Sem histórico no dia 1 (fallback heurístico)

- **Calendários promocionais extraídos dos encartes** ("Quarta Verde", "Terça da Carne", "Sexta do Peixe" são padrões comuns em redes brasileiras): Firecrawl já entrega a validade e o dia; uma regra simples "esta rede repete esta categoria em promoção neste dia da semana em ≥ 3 das últimas 4 semanas" gera a dica com confiança moderada.
- **Sazonalidade conhecida de hortifrúti** (tabelas públicas de ceasas) como prior.
- Toda dica mostra a fonte: *"Baseado nos encartes das últimas 4 semanas"* ou *"Previsão Vigil Labs"*.

---

## 2.5 Testes obrigatórios do motor

| Teste | Propriedade |
|-------|-------------|
| Monotonicidade | Baixar o preço de um item numa loja nunca piora o total dessa loja. |
| Histerese | Economia de divisão < limiar ⇒ `primary.type === "single"`. |
| Invariância a anúncios | `optimize(inputs)` é idêntico com qualquer conteúdo nas tabelas de anúncios (Seção 3.6). |
| Determinismo | Mesmo input ⇒ mesmo `ranking_hash` (ordenar chaves; desempate por `store_id`). |
| Golden de demo | Cesta fixa do bairro da demo ⇒ veredito conhecido (protege a demo de regressões). |
