# Seção 3 — Tese de Monetização B2B & Modelo "Google Ads Físico"

> Tese: a lista de compras ativa é o **sinal de intenção mais forte do varejo físico** — é um "termo de busca" com data, local e carrinho. Monetizamos a intenção **ao redor** do veredito, nunca **dentro** dele.

## 3.1 Visão dos 4 pilares

| Pilar | Quem paga | Gatilho de cobrança | Prova de entrega | Fase |
|-------|-----------|---------------------|------------------|------|
| 1. CPC de Intenção Local | Lojista / rede | Clique em "ver oferta" ou "adicionar à rota" | Log de clique + (opcional) NFC-e posterior na loja | MVP (mock) → piloto |
| 2. Retail Media / Cashback de Marca | Indústria (marca) | Item comprado e auditado via NFC-e | Chave NFC-e + item + CNPJ | Piloto |
| 3. SaaS de Demanda Regional | Lojista, rede, indústria | Assinatura mensal | — | Pós-MVP (painel na demo) |
| 4. Pins Patrocinados na Rota | Lojista | CPM / clique no pin | Log de impressão no mapa | Pós-MVP |

> Valores de preço citados abaixo são **hipóteses** para pitch; calibrar em piloto.

---

## 3.2 Pilar 1 — CPC de Intenção Local

**Mecânica.** O lojista cria uma campanha: *produto ou categoria* + *raio* + *lance máximo*. Quando um usuário com aquele produto na lista ativa estiver dentro do raio, a oferta aparece no **slot "Ofertas perto de você"** (rotulado *Patrocinado*), abaixo do veredito.

**Leilão.** Segundo preço generalizado com *quality score*:

```
ad_rank = lance × qualidade
qualidade = CTR_previsto × relevância (produto exato > categoria) × honestidade_de_preço
honestidade_de_preço = 1 se o preço anunciado bate com a última NFC-e daquela loja (±3 %), senão decai
```

O termo `honestidade_de_preço` é o diferencial: anúncio com preço que a NFC-e desmente perde alcance — **o dado auditado disciplina o anunciante**.

```sql
CREATE TABLE ad_campaigns (
  id            bigserial PRIMARY KEY,
  advertiser_id bigint NOT NULL,
  store_id      bigint REFERENCES stores(id),
  target_product_id bigint REFERENCES products(id),
  target_category_id smallint REFERENCES categories(id),
  radius_m      integer NOT NULL CHECK (radius_m BETWEEN 300 AND 10000),
  max_cpc       numeric(6, 2) NOT NULL,          -- hipótese: R$ 0,40–1,50
  daily_budget  numeric(10, 2) NOT NULL,
  offer_price   numeric(10, 2),
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  CHECK (target_product_id IS NOT NULL OR target_category_id IS NOT NULL)
);

CREATE TABLE ad_events (
  id           bigserial PRIMARY KEY,
  campaign_id  bigint NOT NULL REFERENCES ad_campaigns(id),
  verdict_id   text NOT NULL,                    -- liga o anúncio ao veredito que ele acompanhou
  kind         text NOT NULL CHECK (kind IN ('impression', 'click', 'add_to_route')),
  charged      numeric(6, 2),
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

**Atribuição de venda (diferencial frente a mídia comum):** se o usuário escaneia uma NFC-e daquela loja nas 48 h seguintes ao clique, temos **conversão offline comprovada** — ROAS real de mídia física, algo que o varejo de bairro nunca teve.

---

## 3.3 Pilar 2 — Retail Media / Cashback de Marca auditado por NFC-e

**Mecânica.** A marca oferece *"R$ 2 de volta em Nescau 400 g"*. O usuário que tem "achocolatado" na lista vê o cashback (slot rotulado). Depois de comprar, escaneia a NFC-e; o sistema audita e credita.

**Auditoria determinística de um *claim*:**

```ts
function auditClaim(claim: Claim, nfce: ParsedNFCe, offer: CashbackOffer): AuditResult {
  const checks = {
    chaveValida:       nfce.dvOk && nfce.modelo === "65",
    naoUsadaAntes:     !db.claimExists(nfce.chave, offer.id),                 // UNIQUE (chave, offer_id)
    dentroDaCampanha:  nfce.emitidaEm >= offer.startsAt && nfce.emitidaEm <= offer.endsAt,
    lojaElegivel:      offer.cnpjs.length === 0 || offer.cnpjs.includes(nfce.cnpj),
    itemPresente:      nfce.itens.some((i) => i.productId === offer.productId && i.resolverConfidence >= 0.9),
    usuarioDentroLimite: db.userClaimsCount(claim.userId, offer.id) < offer.maxPerUser,
    consultaSefazOk:   nfce.source === "sefaz",                               // foto do cupom sozinha NÃO credita
  };
  return { approved: Object.values(checks).every(Boolean), checks };
}
```

```sql
CREATE TABLE cashback_offers (
  id           bigserial PRIMARY KEY,
  brand        text NOT NULL,
  product_id   bigint NOT NULL REFERENCES products(id),
  amount       numeric(6, 2) NOT NULL,
  cnpjs        char(14)[] NOT NULL DEFAULT '{}',   -- vazio = qualquer loja
  max_per_user integer NOT NULL DEFAULT 1,
  budget       numeric(12, 2) NOT NULL,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL
);

CREATE TABLE cashback_claims (
  id          bigserial PRIMARY KEY,
  offer_id    bigint NOT NULL REFERENCES cashback_offers(id),
  user_id     uuid NOT NULL,
  nfce_chave  char(44) NOT NULL,
  status      text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  checks      jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, nfce_chave)
);
```

**Por que a indústria paga:** hoje a marca não sabe o que acontece no PDV de bairro. Aqui ela recebe *sell-out* verificado por documento fiscal, com CNPJ e hora, por região. **Efeito colateral estratégico:** cada cashback é um incentivo para o usuário escanear a nota — ou seja, **a monetização financia a ingestão da fonte de dados mais confiável**.

Pagamento ao usuário: saldo interno resgatável via Pix acima de um mínimo (ex.: R$ 10), o que reduz custo transacional.

---

## 3.4 Pilar 3 — Painel SaaS de Demanda Regional

**O que vende:** *"Nesta semana, 1.240 listas num raio de 2 km da sua loja tinham carne bovina; você ganhou o veredito em 18 % delas; perdeu principalmente em: arroz 5 kg (−R$ 2,10 vs. concorrente)."*

**Agregação com privacidade (LGPD by design):**
- Unidade espacial: **célula H3 res. 8** (~0,7 km²); nunca coordenadas brutas.
- **k-anonimato**: só exibir agregados com ≥ 20 usuários distintos na célula × semana × categoria; abaixo disso, mescla com células vizinhas ou omite.
- Sem dados pessoais no painel; IDs de usuário nunca saem do banco transacional.
- Base legal: consentimento explícito no onboarding para uso agregado, com opt-out.

```sql
CREATE MATERIALIZED VIEW demand_weekly AS
SELECT
  date_trunc('week', l.created_at) AS week,
  l.h3_r8,
  p.category_id,
  count(DISTINCT l.user_id) AS users,
  count(*)                  AS list_items
FROM list_items li
JOIN lists l    ON l.id = li.list_id
JOIN products p ON p.id = li.product_id
GROUP BY 1, 2, 3
HAVING count(DISTINCT l.user_id) >= 20;            -- k-anonimato no próprio dado servido
```

**Planos (hipótese):** Bairro (R$ 149/mês, 1 loja), Rede (por loja), Indústria (por região/categoria). O "Win/Loss do veredito" é o recurso âncora: o lojista vê **exatamente** quais preços o fazem perder — e a única forma de ganhar é **baixar o preço** (não existe "pagar para ganhar o veredito").

---

## 3.5 Pilar 4 — Pins Patrocinados na Rota

O mapa do veredito usa a **Maps JavaScript API**; os pins patrocinados são marcadores do **próprio app** (`AdvancedMarkerElement` com estilo e rótulo *Patrocinado*) — não é um produto de anúncio do Google. Só aparecem lojas no **corredor da rota** já escolhida:

```sql
-- $1: polilinha da rota (Routes API) convertida para WKT LINESTRING; $2: store_ids do veredito
SELECT c.id AS campaign_id, s.id AS store_id, s.name, c.offer_price,
       ST_Distance(s.geog, ST_GeogFromText($1)) AS desvio_m
FROM ad_campaigns c
JOIN stores s ON s.id = c.store_id
WHERE now() BETWEEN c.starts_at AND c.ends_at
  AND ST_DWithin(s.geog, ST_GeogFromText($1), 400)  -- até 400 m da rota
  AND s.id <> ALL($2::bigint[])
ORDER BY c.max_cpc DESC
LIMIT 2;                                            -- máx. 2 pins para não poluir
```

---

## 3.6 Como provar que o ranking de menor preço nunca é vendido

Esta é a pergunta que os jurados vão fazer. A resposta precisa ser **técnica e verificável**, não uma promessa.

### Camada 1 — Arquitetura (impossível por construção)

```
 lib/verdict/   ← função pura: (lista, preços, rotas, perfil) → veredito
     ⛔ não importa nada de lib/ads/ nem lê tabelas ad_* / cashback_*
 lib/ads/       ← leilão e seleção de slots patrocinados
 app/api/verdict/route.ts
     1. verdict = optimize(...)                 (core neutro)
     2. ranking_hash = sha256(verdict + inputs)
     3. sponsored = selectAds(verdict)          (só DEPOIS, só lê o veredito)
     4. return { ...verdict, ranking_hash, sponsored }
```

- **Regra de lint** que quebra o build se o core importar anúncios:

```js
// eslint.config.mjs (trecho)
{
  files: ["lib/verdict/**/*.ts"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["**/ads/**", "**/cashback/**"], message: "O motor de veredito é neutro: não pode depender de anúncios." },
      ],
    }],
  },
}
```

- **Credencial de banco separada**: o serviço de veredito usa um role Postgres **sem `SELECT`** em `ad_*` e `cashback_*`:

```sql
CREATE ROLE verdict_ro NOLOGIN;
GRANT SELECT ON stores, products, categories, current_prices, stock_signal TO verdict_ro;
-- nenhum GRANT em ad_campaigns, ad_events, cashback_offers, cashback_claims
```

### Camada 2 — Teste de invariância no CI

```ts
// lib/verdict/__tests__/neutrality.test.ts
test("anúncios não alteram o ranking", () => {
  const base = buildVerdict(fixture, { ads: [] });
  for (const ads of randomAdSets(500)) {                 // lances absurdos, lojas aleatórias
    const v = buildVerdict(fixture, { ads });
    expect(v.ranking_hash).toBe(base.ranking_hash);
    expect(v.primary).toEqual(base.primary);
  }
});
```

### Camada 3 — Auditoria pública por veredito

- Cada veredito grava `(verdict_id, algo_version, inputs_canonicos, ranking_hash)` numa tabela *append-only* (sem `UPDATE`/`DELETE` para o role da aplicação).
- Página **/transparencia**: fórmula de custo publicada, versão do algoritmo, e um verificador "cole seu `verdict_id`" que **recomputa** o veredito com os mesmos inputs e confere o hash.
- **Toggle na demo**: "Desligar todos os anúncios" → o veredito na tela não muda; o hash exibido é o mesmo. É a prova ao vivo em 10 segundos.

### Camada 4 — Regras de produto

- Patrocinado **sempre** rotulado, em slot fixo **abaixo** do veredito, nunca intercalado.
- Patrocinado **nunca** usa a cor/selo "Mais barato".
- O lojista só melhora sua posição no veredito **baixando o preço real** (confirmado por NFC-e). Isso vira argumento comercial: *"o nosso ranking é o único que o seu concorrente não pode comprar."*

---

## 3.7 Por que isso é estratégico para o Google

- **Intenção local de alta qualidade** é exatamente o território de Local Ads / Performance Max para lojas físicas — mas com o elo que falta: **conversão offline auditada por documento fiscal**.
- Toda a pilha roda nativamente em GCP + Gemini + Maps Platform (Places, Routes, Maps JS), o que torna o projeto uma vitrine de *reference architecture* para varejo na América Latina.
- O veredito exposto como *tool* para agentes (Seção 5.5) encaixa o varejo de bairro no comércio agêntico sem que cada mercadinho precise integrar API alguma.
