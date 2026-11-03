# Seção 1 — Arquitetura de Dados & Pipeline de Ingestão Resiliente

> Objetivo: transformar três fontes heterogêneas e sujas em **uma tabela de observações de preço confiável, georreferenciada e comparável**, consultável em < 100 ms por raio.

## 1.1 Visão geral

```
                ┌──────────────────────── FONTES ────────────────────────┐
                │                                                        │
  Encartes      │  Firecrawl (HTML / PDF de encarte, sites de rede)       │  cobertura (muitos itens, preço "anunciado")
  NFC-e         │  QR Code da nota → página pública da Sefaz → Firecrawl  │  prova (preço pago, CNPJ, timestamp)
  Comunidade    │  Foto de gôndola / etiqueta / correção manual no app    │  frescor (minutos)
                └──────────────┬─────────────────────────────────────────┘
                               ▼
        Cloud Run "ingest-api"  →  Pub/Sub topic `raw-observations`  (payload bruto + metadados, imutável em GCS)
                               ▼
        Cloud Run "normalizer" (worker)
          1. Parse determinístico (regex de tamanho/unidade, GTIN, CNPJ, chave NFC-e)
          2. Resolução de loja (CNPJ → Places API → stores)
          3. Resolução de SKU (GTIN → alias → pg_trgm → Gemini) ── confiança
          4. Sanitização (outliers MAD, reputação do autor, dedupe)
                               ▼
        Cloud SQL PostgreSQL 16 + PostGIS  ── `price_observations` (append-only)
                               ▼
        MATERIALIZED VIEW `current_prices` (refresh a cada 10 min via Cloud Scheduler)
                               ▼
        API de veredito (Seção 2)
```

**Princípios de resiliência**

| Princípio | Implementação |
|-----------|---------------|
| Bruto imutável | Todo payload bruto (HTML, PDF, foto, texto) vai para `gs://lista-esperta-raw/{fonte}/{yyyy-mm-dd}/{uuid}` antes de qualquer parse. Reprocessar = reler GCS com normalizador novo. |
| Idempotência | Chave natural por fonte: NFC-e = `chave_acesso` (44 dígitos) + nº do item; encarte = `hash(url + validade + texto_item)`; crowd = `hash(user + loja + produto + preço + janela de 1 h)`. `INSERT ... ON CONFLICT DO NOTHING`. |
| Desacoplamento | Pub/Sub entre recepção e normalização: se Gemini/Firecrawl caírem, as mensagens esperam (retry exponencial + dead-letter topic). |
| Degradação | Se o LLM falhar, a observação entra como `status='quarantine'` com o texto cru; nunca é descartada e nunca é usada em comparação. |
| Observabilidade | Métricas por fonte: taxa de match de SKU, % quarentena, latência p95, custo de tokens por observação. |

---

## 1.2 As três fontes

### A) Encartes via Firecrawl

**O que é:** páginas de ofertas das redes, PDFs de encarte semanal e agregadores de encarte.

**Fluxo:**
1. Cadastro manual (MVP) de ~20 URLs de encarte das lojas do bairro da demo, em `sources(url, store_chain, kind, cron)`.
2. Cloud Scheduler dispara o *crawler* (diário; encartes mudam ~1×/semana).
3. Firecrawl faz o scrape com **extração estruturada por schema** (formato JSON) — também funciona para PDF de encarte.
4. Cada item extraído vira uma mensagem em `raw-observations` com `source='encarte'`.

```ts
// lib/ingest/firecrawl.ts — adapter (valide nomes de endpoint/campos na doc vigente da Firecrawl)
const OFFER_SCHEMA = {
  type: "object",
  properties: {
    validade_inicio: { type: "string", description: "data ISO, se houver" },
    validade_fim:    { type: "string", description: "data ISO, se houver" },
    lojas_participantes: { type: "array", items: { type: "string" } },
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          texto_original: { type: "string" },
          preco:          { type: "number" },
          preco_de:       { type: "number", description: "preço riscado, se houver" },
          unidade_venda:  { type: "string", description: "un, kg, pacote, caixa..." },
          condicao:       { type: "string", description: "ex: 'leve 3 pague 2', 'a partir de 6 un', 'com cartão da loja'" },
        },
        required: ["texto_original", "preco"],
      },
    },
  },
  required: ["itens"],
} as const;

export async function scrapeFlyer(url: string) {
  const res = await fetch(`${process.env.FIRECRAWL_API_URL}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [{
        type: "json",
        schema: OFFER_SCHEMA,
        prompt:
          "Extraia TODAS as ofertas de supermercado desta página/PDF. Não invente preços. " +
          "Se o preço exige condição (cartão fidelidade, quantidade mínima, leve X pague Y), preencha 'condicao'.",
      }],
    }),
  });
  if (!res.ok) throw new Error(`firecrawl ${res.status}`);
  return res.json();
}
```

**Cuidados específicos de encarte**
- **Preço condicional** (`condicao` preenchida) é armazenado com `min_qty`/`requires_loyalty`, e o motor só o usa se a quantidade da lista satisfizer a condição.
- **Validade:** `promo_valid_until` vem do encarte; após a data, a observação perde peso a zero.
- **"Preço anunciado ≠ preço na gôndola":** peso de confiança base 0,6 (vs. 0,95 da NFC-e).

### B) NFC-e via QR Code (a "hard proof")

A NFC-e (modelo 65) tem um QR Code cujo conteúdo é uma URL da Sefaz do estado emissor com o parâmetro `p=` contendo a **chave de acesso de 44 dígitos**. A chave já carrega, sem nenhuma chamada de rede:

| Posição | Campo | Uso |
|---------|-------|-----|
| 1–2 | cUF (código IBGE do estado) | Escolher o parser da Sefaz correta |
| 3–6 | AAMM de emissão | Data aproximada (filtro anti-nota-velha) |
| 7–20 | **CNPJ do emitente** | Identificar a loja |
| 21–22 | Modelo (`65`) | Validar que é NFC-e |
| 23–25 | Série | — |
| 26–34 | Número | — |
| 35 | Tipo de emissão | Contingência offline (`9`) → consulta pode demorar a ficar disponível |
| 36–43 | Código numérico | — |
| 44 | Dígito verificador (módulo 11) | **Validação local**: rejeita QR adulterado antes de gastar crawl |

```ts
// lib/ingest/nfce.ts
export function parseChaveNFCe(qrUrl: string) {
  const p = new URL(qrUrl).searchParams.get("p") ?? "";
  const chave = p.split("|")[0];
  if (!/^\d{44}$/.test(chave)) throw new Error("chave inválida");
  if (chave.slice(20, 22) !== "65") throw new Error("não é NFC-e");
  if (dvModulo11(chave.slice(0, 43)) !== Number(chave[43])) throw new Error("DV inválido");
  return {
    chave,
    cUF: chave.slice(0, 2),
    anoMes: chave.slice(2, 6),
    cnpj: chave.slice(6, 20),
    tpEmis: chave[34],
  };
}

function dvModulo11(base43: string): number {
  let peso = 2, soma = 0;
  for (let i = base43.length - 1; i >= 0; i--) {
    soma += Number(base43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}
```

**Fluxo:**
1. PWA lê o QR com `BarcodeDetector` (Chrome/Android) ou fallback `@zxing/browser` (iOS).
2. Validação local da chave (acima) → `POST /api/nfce` com a URL.
3. Backend: dedupe por `chave`; resolve loja por **CNPJ** (se nova: Places API Text Search com razão social + cidade → `stores`).
4. Firecrawl abre a URL pública de consulta e extrai itens (`descricao`, `codigo`, `qtd`, `unidade`, `valor_unit`, `valor_total`) + data/hora de emissão.
5. Cada item → `raw-observations` com `source='nfce'`, `observed_at = data de emissão`.

**Resiliência (Sefaz é o ponto mais frágil):**
- Parsers por UF registrados em `nfce_parsers` com *health check* diário; MVP: **só a UF da demo** (ex.: SP, `cUF=35`).
- Se a consulta exigir captcha ou falhar: (a) fila com retry em 15 min/1 h/6 h (notas em contingência só aparecem depois); (b) **fallback multimodal**: usuário fotografa o cupom e o Gemini extrai os itens; a chave do QR continua sendo a prova de unicidade e de CNPJ.
- Nunca resolver captcha automaticamente. Se a UF bloquear, a fonte daquela UF passa a ser só foto do cupom.

### C) Crowdsourcing

- Ações: foto de etiqueta de gôndola, "confirmar preço" (1 toque em cima de um preço já existente), "preço errado".
- Gemini extrai `{produto, preco, unidade, condicao}` da foto; geolocalização do aparelho + Places Nearby (raio 80 m) sugere a loja e o usuário confirma.
- **Anti-fraude:** o peso de confiança inicial é baixo (0,3) e sobe com a **reputação** do autor (`reporter_trust`, calibrada pela taxa histórica de concordância com NFC-e posteriores da mesma loja). Limite de taxa por usuário/loja/dia. Fotos sem EXIF recente ou geolocalização a > 300 m da loja entram em quarentena.

---

## 1.3 Sanitização

Executada no normalizador, nesta ordem:

1. **Parse determinístico de tamanho/unidade** (nunca confie no LLM para números): regex para `(\d+[.,]?\d*)\s*(kg|g|l|lt|ml|un|und|pct)` e multipacks `(\d+)\s*x\s*(\d+)\s*(ml|g)`. Converte para unidade-base (`kg`, `l`, `un`).
2. **Cálculo de preço unitário** `unit_price = price / net_quantity_base` — é o que permite comparar "Leite 1L" com "Leite caixa 12×1L".
3. **Outlier robusto por produto × região** (célula H3 res. 7 ou raio de 10 km):
   `z = 0,6745 × (preço − mediana) / MAD` → `|z| > 3,5` ⇒ `quarantine`. Exceção: NFC-e (preço pago é fato; outliers de NFC-e geralmente indicam erro de SKU, então o *alias* é que vai para revisão).
4. **Consistência de SKU:** se a unidade parseada não bate com `products.base_unit` do candidato (ex.: texto diz "1kg", produto é litro) ⇒ match rejeitado, independente da confiança do LLM.
5. **Dedupe** pela chave natural (seção 1.1).

---

## 1.4 Schema PostgreSQL + PostGIS

```sql
-- db/migrations/0001_init.sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TYPE store_format AS ENUM ('atacarejo', 'supermercado', 'varejo_bairro', 'hortifruti', 'acougue', 'padaria');
CREATE TYPE price_source AS ENUM ('nfce', 'encarte', 'crowd', 'site');
CREATE TYPE obs_status   AS ENUM ('accepted', 'quarantine', 'rejected');

-- Lojas ---------------------------------------------------------------
CREATE TABLE stores (
  id               bigserial PRIMARY KEY,
  cnpj             char(14) UNIQUE,                 -- vem da NFC-e
  google_place_id  text UNIQUE,                     -- vem do Places
  name             text NOT NULL,
  chain            text,                            -- 'assai', 'atacadao', ... (aliases por rede)
  format           store_format NOT NULL,
  geog             geography(Point, 4326) NOT NULL,
  address          text,
  opening_hours    jsonb,                           -- cache do Places (TTL curto, ver ToS)
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stores_geog_gix ON stores USING gist (geog);

-- Catálogo canônico ---------------------------------------------------
CREATE TABLE categories (
  id             smallserial PRIMARY KEY,
  slug           text UNIQUE NOT NULL,              -- 'laticinios', 'hortifruti', 'limpeza'...
  name           text NOT NULL,
  perishable     boolean NOT NULL DEFAULT false,
  split_affinity text CHECK (split_affinity IN ('atacado', 'bairro', 'neutro')) DEFAULT 'neutro'
);

CREATE TABLE products (
  id               bigserial PRIMARY KEY,
  gtin             varchar(14) UNIQUE,              -- EAN-8/13/14; NULL para granel/hortifrúti
  canonical_name   text NOT NULL,                   -- 'Leite UHT Integral Itambé 1 L'
  brand            text,
  category_id      smallint NOT NULL REFERENCES categories(id),
  base_unit        text NOT NULL CHECK (base_unit IN ('kg', 'l', 'un')),
  net_quantity     numeric(10, 3) NOT NULL,         -- em base_unit (1 L => 1.000; 395 g => 0.395)
  attributes       jsonb NOT NULL DEFAULT '{}',     -- {"tipo":"integral","embalagem":"caixa"}
  -- Chave de equivalência SEM marca: permite "qualquer leite integral 1L"
  equivalence_key  text NOT NULL                    -- 'leite|uht|integral|1l'
);
CREATE INDEX products_name_trgm ON products USING gin (canonical_name gin_trgm_ops);
CREATE INDEX products_equiv     ON products (equivalence_key);

-- Memória de normalização: texto sujo -> produto ----------------------
CREATE TABLE product_aliases (
  id            bigserial PRIMARY KEY,
  raw_norm      text NOT NULL,                      -- lower(unaccent(texto)), espaços colapsados
  chain         text NOT NULL DEFAULT '',           -- abreviações são por rede ("LT LEITE ITAMB INT")
  product_id    bigint NOT NULL REFERENCES products(id),
  resolver      text NOT NULL,                      -- 'gtin' | 'exact' | 'trgm' | 'gemini' | 'human'
  confidence    real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  verified      boolean NOT NULL DEFAULT false,
  UNIQUE (raw_norm, chain)
);
CREATE INDEX product_aliases_trgm ON product_aliases USING gin (raw_norm gin_trgm_ops);

-- Fato central: observações de preço (append-only) --------------------
CREATE TABLE price_observations (
  id                bigserial,
  store_id          bigint NOT NULL REFERENCES stores(id),
  product_id        bigint NOT NULL REFERENCES products(id),
  price             numeric(10, 2) NOT NULL CHECK (price > 0),
  unit_price        numeric(12, 4) NOT NULL,         -- price / products.net_quantity (calculado no worker)
  min_qty           integer NOT NULL DEFAULT 1,      -- "a partir de 6 un" / atacado
  requires_loyalty  boolean NOT NULL DEFAULT false,
  promo_valid_until date,
  source            price_source NOT NULL,
  source_ref        text NOT NULL,                   -- chave NFC-e + item | hash do encarte | hash crowd
  reporter_id       uuid,                            -- NULL para encarte
  trust             real NOT NULL CHECK (trust BETWEEN 0 AND 1),
  status            obs_status NOT NULL DEFAULT 'accepted',
  observed_at       timestamptz NOT NULL,
  ingested_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, observed_at),
  UNIQUE (source, source_ref, observed_at)
) PARTITION BY RANGE (observed_at);

-- Partições mensais (criar via job; exemplo):
CREATE TABLE price_observations_2026_11 PARTITION OF price_observations
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE INDEX price_obs_lookup ON price_observations (product_id, store_id, observed_at DESC)
  WHERE status = 'accepted';
```

### Visão materializada de "preço vigente"

Escolhe **uma** observação por (loja, produto) pela pontuação `trust × decaimento temporal`, com meia-vida por fonte (NFC-e 72 h, encarte até a validade, crowd 24 h):

```sql
CREATE MATERIALIZED VIEW current_prices AS
WITH scored AS (
  SELECT
    po.store_id, po.product_id, po.price, po.unit_price, po.min_qty, po.requires_loyalty,
    po.source, po.observed_at,
    po.trust * CASE
      WHEN po.source = 'encarte' AND po.promo_valid_until IS NOT NULL
        THEN CASE WHEN po.promo_valid_until >= current_date THEN 1 ELSE 0 END
      ELSE exp(-ln(2) * extract(epoch FROM now() - po.observed_at) / 3600.0
               / CASE po.source WHEN 'nfce' THEN 72 WHEN 'crowd' THEN 24 ELSE 120 END)
    END AS score
  FROM price_observations po
  WHERE po.status = 'accepted'
    AND po.observed_at > now() - interval '21 days'
)
SELECT DISTINCT ON (store_id, product_id)
  store_id, product_id, price, unit_price, min_qty, requires_loyalty, source, observed_at, score,
  count(*) FILTER (WHERE observed_at > now() - interval '24 hours')
    OVER (PARTITION BY store_id, product_id) AS observations_24h
FROM scored
WHERE score > 0.05
ORDER BY store_id, product_id, score DESC;

CREATE UNIQUE INDEX current_prices_pk ON current_prices (store_id, product_id);
CREATE INDEX current_prices_product ON current_prices (product_id);

-- Cloud Scheduler a cada 10 min:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY current_prices;
```

### "Estoque indireto"

Não temos estoque real. Usamos **sinal de venda recente**: se a NFC-e mostra que alguém comprou o item naquela loja há poucas horas, a probabilidade de disponibilidade é alta.

```sql
CREATE MATERIALIZED VIEW stock_signal AS
SELECT store_id, product_id,
       max(observed_at) AS last_sale_at,
       exp(-extract(epoch FROM now() - max(observed_at)) / 3600.0 / 48) AS availability_score -- ~1 = vendido agora
FROM price_observations
WHERE source = 'nfce' AND status = 'accepted' AND observed_at > now() - interval '14 days'
GROUP BY store_id, product_id;
CREATE UNIQUE INDEX stock_signal_pk ON stock_signal (store_id, product_id);
```

### Query principal: cesta × lojas no raio

```sql
-- $1 lng, $2 lat, $3 raio_m, $4 product_ids bigint[], $5 qtys numeric[]
WITH me AS (
  SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g
),
nearby AS (
  SELECT s.id, s.name, s.chain, s.format, ST_Distance(s.geog, me.g) AS dist_m
  FROM stores s, me
  WHERE ST_DWithin(s.geog, me.g, $3)          -- usa o índice GiST
),
wanted AS (
  SELECT * FROM unnest($4::bigint[], $5::numeric[]) AS w(product_id, qty)
)
SELECT
  n.id AS store_id, n.name, n.format, round(n.dist_m) AS dist_m,
  cp.product_id, w.qty, cp.price, cp.min_qty, cp.requires_loyalty,
  cp.source, cp.observed_at, cp.observations_24h,
  coalesce(ss.availability_score, 0.5) AS availability
FROM nearby n
JOIN current_prices cp ON cp.store_id = n.id
JOIN wanted w          ON w.product_id = cp.product_id
LEFT JOIN stock_signal ss ON ss.store_id = cp.store_id AND ss.product_id = cp.product_id;
-- Retorna a MATRIZ item × loja; a otimização (Seção 2) é feita em TypeScript.
```

**Variante "sem marca"** (o usuário escreveu "leite integral", não "Itambé"): troca `product_id` por `equivalence_key` e pega, por loja, o equivalente de **menor `unit_price`**:

```sql
SELECT DISTINCT ON (cp.store_id, p.equivalence_key)
  cp.store_id, p.equivalence_key, p.id AS product_id, p.canonical_name, cp.price, cp.unit_price
FROM current_prices cp
JOIN products p ON p.id = cp.product_id
WHERE p.equivalence_key = ANY($1::text[])
  AND cp.store_id = ANY($2::bigint[])            -- ids do CTE nearby
ORDER BY cp.store_id, p.equivalence_key, cp.unit_price ASC;
```

**Performance esperada:** `ST_DWithin` em geography com GiST para ~10 mil lojas numa capital resolve em poucos ms; o gargalo é o join com `current_prices`, que é coberto por índice único. Meta: p95 < 80 ms para listas de 40 itens.

---

## 1.5 Normalização de SKU com Gemini Multimodal

### Pipeline em cascata (do mais barato e determinístico ao LLM)

```
texto/foto bruto
   │
   ├─(1) GTIN presente e válido (dígito verificador EAN)?  ──► products.gtin           confiança 1,00
   ├─(2) alias exato (raw_norm, chain)?                    ──► product_aliases          confiança do alias
   ├─(3) pg_trgm: top-10 candidatos por similaridade (> 0,3) em products + aliases
   ├─(4) Gemini escolhe ENTRE OS CANDIDATOS (ou "NOVO"/"INCERTO") com saída em JSON schema
   └─(5) Regras pós-LLM (unidade/tamanho parseados por regex DEVEM bater com o produto)
            │
            ├── ≥ 0,90  → aceito; grava alias (resolver='gemini')
            ├── 0,70–0,90 → aceito para a MESMA marca; NÃO entra em comparação "sem marca" até verificação
            └── < 0,70 ou conflito de unidade → quarentena (fila de revisão humana / crowd "isso é...?")
```

Por que o LLM escolhe entre candidatos em vez de gerar livremente: **elimina alucinação de produto**, deixa o custo previsível (prompt curto) e cria um conjunto de avaliação natural (candidato certo está ou não está no top-10).

### Prompt 1 — Lista de compras (foto manuscrita ou texto) → itens estruturados

```text
SISTEMA:
Você converte listas de compras brasileiras (manuscritas, digitadas, fotos de papel, prints de WhatsApp)
em itens estruturados. Regras:
- Um item por linha da lista. Não invente itens.
- Expanda abreviações comuns: "lt" = leite, "cx" = caixa, "pct" = pacote, "dz" = dúzia, "refri" = refrigerante.
- quantidade: número de unidades de venda que a pessoa quer (padrão 1). "2kg de carne" → quantidade 2, unidade "kg".
- marca_exigida: true SOMENTE se a pessoa escreveu uma marca. Se não escreveu, marca = null e marca_exigida = false.
- categoria: uma de [hortifruti, acougue, laticinios, mercearia, bebidas, limpeza, higiene, padaria, congelados, pet, outros].
- Se a caligrafia for ilegível, devolva o trecho em "texto_original" e confianca < 0.5. Nunca adivinhe silenciosamente.

USUÁRIO: [imagem ou texto da lista]
```

Schema de resposta (passado como `responseSchema` com `responseMimeType: "application/json"`):

```json
{
  "type": "object",
  "properties": {
    "itens": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "texto_original": { "type": "string" },
          "nome_generico":  { "type": "string", "description": "ex: 'leite integral'" },
          "marca":          { "type": "string", "nullable": true },
          "marca_exigida":  { "type": "boolean" },
          "quantidade":     { "type": "number" },
          "unidade":        { "type": "string", "enum": ["un", "kg", "g", "l", "ml", "pacote", "caixa", "duzia"] },
          "tamanho_embalagem": { "type": "string", "nullable": true, "description": "ex: '1 L', '5 kg'" },
          "categoria":      { "type": "string" },
          "confianca":      { "type": "number" }
        },
        "required": ["texto_original", "nome_generico", "marca_exigida", "quantidade", "unidade", "categoria", "confianca"]
      }
    }
  },
  "required": ["itens"]
}
```

### Prompt 2 — Linha suja de NFC-e/encarte → SKU canônico (escolha entre candidatos)

```text
SISTEMA:
Você é um normalizador de SKUs de supermercado brasileiro. Recebe UMA descrição bruta (de cupom fiscal ou encarte)
e uma lista de CANDIDATOS do catálogo. Escolha o candidato que é EXATAMENTE o mesmo produto.

"Mesmo produto" exige TODOS: mesma marca (se a descrição tiver marca), mesmo tipo/variante
(integral ≠ desnatado ≠ semidesnatado; zero ≠ tradicional; refil ≠ frasco), e mesmo tamanho de embalagem.

Abreviações frequentes em cupons: LT=leite, INT/INTEGR=integral, DESN=desnatado, UHT, REFRIG/REF=refrigerante,
DET=detergente, SAB=sabão/sabonete, AMAC=amaciante, PCT=pacote, CX=caixa, FD=fardo, UN=unidade, KG, GR=gramas.

Se nenhum candidato for exatamente igual, responda decisao="NOVO" e preencha "produto_novo".
Se houver ambiguidade real (ex.: tamanho ausente na descrição), responda decisao="INCERTO".
NUNCA escolha um candidato "parecido". Comparar produtos diferentes é o pior erro possível neste sistema.

USUÁRIO:
descricao_bruta: "LT ITAMBE INTEGR 1L"
rede: "assai"
gtin_informado: null
tamanho_parseado: { "quantidade": 1, "unidade": "l" }
candidatos:
  [101] Leite UHT Integral Itambé 1 L
  [102] Leite UHT Desnatado Itambé 1 L
  [215] Leite UHT Integral Piracanjuba 1 L
  [388] Leite em Pó Integral Itambé 400 g
```

```json
{
  "type": "object",
  "properties": {
    "decisao":     { "type": "string", "enum": ["CANDIDATO", "NOVO", "INCERTO"] },
    "candidato_id": { "type": "integer", "nullable": true },
    "confianca":   { "type": "number" },
    "justificativa": { "type": "string", "description": "máx. 20 palavras; usado em auditoria" },
    "produto_novo": {
      "type": "object", "nullable": true,
      "properties": {
        "canonical_name":  { "type": "string" },
        "marca":           { "type": "string", "nullable": true },
        "categoria":       { "type": "string" },
        "base_unit":       { "type": "string", "enum": ["kg", "l", "un"] },
        "net_quantity":    { "type": "number" },
        "equivalence_key": { "type": "string", "description": "formato 'generico|tipo|variante|tamanho', sem marca" }
      }
    }
  },
  "required": ["decisao", "confianca", "justificativa"]
}
```

Resposta esperada: `{"decisao":"CANDIDATO","candidato_id":101,"confianca":0.97,"justificativa":"marca Itambé, integral, UHT implícito, 1 L"}`.

### Chamada (adapter)

```ts
// lib/ai/gemini.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function resolveSku(input: ResolveInput): Promise<SkuDecision> {
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_FAST!,            // modelo "Flash" vigente: barato e rápido para esta tarefa
    contents: buildSkuPrompt(input),
    config: {
      systemInstruction: SKU_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: SKU_DECISION_SCHEMA,
      temperature: 0,
    },
  });
  const decision = SkuDecisionZod.parse(JSON.parse(res.text ?? "{}"));
  return enforceHardRules(decision, input);           // unidade/tamanho via regex prevalecem sobre o LLM
}
```

### Avaliação contínua (obrigatório para "hard proof" aos jurados)

- **Golden set**: 300 linhas reais de cupom rotuladas à mão (1 dia de trabalho de 2 pessoas). Rodar a cada mudança de prompt/modelo no CI.
- Métricas: **precisão** de match (meta ≥ 98 % — erro aqui é o pior erro do produto), cobertura (% resolvido sem quarentena, meta ≥ 85 %), custo médio por linha.
- Mostrar esses números no slide de arquitetura da demo.

### Evolução pós-MVP

- Trocar `pg_trgm` por **embeddings** (Gemini embeddings + `pgvector`) na etapa (3) para recuperação semântica ("REFRIG COCA 2L" ↔ "Refrigerante Coca-Cola Original 2 L").
- *Active learning*: itens em quarentena viram micro-tarefas para a comunidade ("Isto é Leite Integral Itambé 1 L? Sim/Não").
