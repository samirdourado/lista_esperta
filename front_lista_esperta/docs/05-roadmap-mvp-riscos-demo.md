# Seção 5 — Checklist Dev Sênior, Roadmap do MVP (4 semanas), Riscos & Demo

## 5.1 Stack recomendada

| Camada | Escolha | Por quê | Alternativa |
|--------|---------|---------|-------------|
| Front / BFF | **Next.js 16 (App Router) PWA** — já no repo | Route Handlers como BFF, Server Components, Cache Components + Partial Prefetching para shell instantâneo | — |
| Hospedagem | **Cloud Run** (container do Next em modo `standalone`) | Escala a zero, mesma região do banco, IAM nativo com Cloud SQL | Firebase App Hosting (também roda Next sobre Cloud Run) |
| Workers de ingestão | Cloud Run (serviço `normalizer`) + **Pub/Sub** + **Cloud Scheduler** | Retries, dead-letter, desacoplamento de provedores instáveis | Cloud Tasks |
| Banco | **Cloud SQL PostgreSQL 16 + PostGIS** | Geoconsultas, `pg_trgm`, consistência; extensão PostGIS suportada | **Supabase** (mais rápido de montar no hackathon; PostGIS + Auth inclusos) |
| Armazenamento bruto | **Cloud Storage** | Reprocessamento, auditoria | — |
| Auth | **Firebase Auth** (Google One Tap + anônimo) | Login só quando necessário; sessão anônima vira conta depois | Supabase Auth |
| IA | **Gemini API** (`@google/genai`) — modelo Flash para OCR/normalização; modelo Pro só para casos difíceis/offline | Multimodal, saída JSON por schema, custo baixo | Vertex AI (mesmo modelo, governança corporativa) |
| Mapas | **Places API (New)** Nearby/Text Search · **Routes API** `computeRouteMatrix` · **Maps JavaScript API** | Lojas, matriz de custo, mapa do veredito | — |
| Scraping | **Firecrawl API** (scrape com extração JSON, PDF) | Encartes e páginas de consulta NFC-e | — |
| Predição | **Vigil Labs** atrás de `PriceForecastProvider` | Intercambiável com heurística/mocks | — |
| Observabilidade | Cloud Logging + Error Reporting + métricas customizadas | — | — |

### Variáveis de ambiente (ver `front_lista_esperta/.env.example`)

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Postgres (Cloud SQL via conector ou Supabase) |
| `GEMINI_API_KEY`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_PRO` | Gemini — IDs de modelo vindos de env para trocar sem deploy de código |
| `GOOGLE_MAPS_SERVER_KEY` | Places + Routes (server-side, restrita por API e IP/conta de serviço) |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Maps JS no cliente (restrita por *HTTP referrer*) |
| `FIRECRAWL_API_URL`, `FIRECRAWL_API_KEY` | Firecrawl |
| `VIGIL_API_URL`, `VIGIL_API_KEY` | Vigil Labs |
| `FORECAST_PROVIDER` | `vigil` \| `heuristic` \| `mock` |
| `DEMO_MODE` | `true` usa a base semeada e mocks determinísticos (protege a demo de falhas de rede) |

### Estrutura de pastas alvo do Next

```
front_lista_esperta/
├─ app/
│  ├─ manifest.ts                     # PWA
│  ├─ page.tsx                        # Tela 1 — Entrada da lista
│  ├─ veredito/[id]/page.tsx          # Tela 2 — Veredito
│  ├─ lojista/page.tsx                # Tela 3 — Painel do lojista
│  ├─ transparencia/page.tsx          # Fórmula + verificador de ranking_hash
│  └─ api/
│     ├─ lists/parse/route.ts         # foto/texto → itens (Gemini)
│     ├─ verdict/route.ts             # itens + posição → veredito
│     ├─ nfce/route.ts                # QR → fila de ingestão
│     ├─ crowd/route.ts               # foto de etiqueta / confirmação
│     └─ agent/quote-basket/route.ts  # tool para agentes (5.5)
├─ lib/
│  ├─ verdict/      # NEUTRO: optimize.ts, confidence.ts, hash.ts (sem I/O, sem ads)
│  ├─ ads/          # leilão, slots patrocinados, pins de rota
│  ├─ ingest/       # firecrawl.ts, nfce.ts, crowd.ts, sanitize.ts
│  ├─ ai/           # gemini.ts, prompts/, schemas/
│  ├─ maps/         # places.ts, routes.ts (com cache H3)
│  ├─ forecast/     # provider.ts, vigil.ts, heuristic.ts, mock.ts
│  └─ db/           # client, queries tipadas
├─ db/migrations/   # SQL da Seção 1.4
├─ workers/normalizer/  # serviço Cloud Run consumindo Pub/Sub
└─ docs/            # este relatório
```

---

## 5.2 Checklist do Dev Sênior

**Dados & backend**
- [ ] Migrations da Seção 1.4 aplicadas; partições mensais criadas por job.
- [ ] `REFRESH MATERIALIZED VIEW CONCURRENTLY` agendado (10 min) com alerta se falhar.
- [ ] Role `verdict_ro` sem acesso a `ad_*`/`cashback_*`; serviço de veredito usa essa credencial.
- [ ] Idempotência por chave natural em todas as fontes; dead-letter topic monitorado.
- [ ] Golden set de 300 linhas de cupom no CI com métricas de precisão/cobertura.

**Motor**
- [ ] `lib/verdict` sem I/O e coberto pelos testes da Seção 2.5 (incluindo neutralidade).
- [ ] Cache da matriz de rotas por (H3 res. 9, modo, hora).
- [ ] `ranking_hash` determinístico (serialização canônica, chaves ordenadas).

**Segurança & compliance**
- [ ] Chaves Maps separadas (server vs. browser) e restritas; nenhuma chave server no bundle (`NEXT_PUBLIC_` só para a do navegador).
- [ ] Rate limit em `/api/lists/parse` e `/api/crowd` (custo de LLM e anti-abuso).
- [ ] Imagens enviadas: limite de tamanho, remoção de EXIF antes de armazenar, retenção de 30 dias.
- [ ] LGPD: consentimento para uso agregado, opt-out, exclusão de conta; k ≥ 20 no painel.
- [ ] Respeitar ToS do Google Maps Platform quanto a cache de conteúdo do Places (armazenar `place_id` de forma persistente; demais campos com TTL).
- [ ] Respeitar robots/termos dos sites de encarte; Sefaz: só consultas disparadas por um usuário com a nota em mãos, sem contornar captcha.

**Front**
- [ ] Lighthouse PWA/performance ≥ 90 em celular médio.
- [ ] Estados: carregando (streaming), vazio (base fria), erro (sem rede), degradado (baixa confiança).
- [ ] Acessibilidade AA, navegação por teclado, leitores de tela nos números.

---

## 5.3 Roadmap — Sprint de 4 semanas

| Semana | Tema | Entregas | Critério de pronto |
|--------|------|----------|--------------------|
| **1** | Fundação & dados | Schema PostGIS; seed de ~15 lojas do bairro-piloto (Places); ingestão Firecrawl de encartes; parser NFC-e da UF piloto + validação de chave; normalizador com cascata GTIN → alias → trgm → Gemini; golden set rotulado | Ver no banco ≥ 2.000 observações aceitas de ≥ 10 lojas; precisão de SKU ≥ 95 % no golden set |
| **2** | Motor & API | `optimize()` 1–2 lojas com histerese; Routes Matrix com cache; `/api/verdict` com `ranking_hash`; `/api/lists/parse` (foto + texto); testes da Seção 2.5 | Lista de 38 itens → veredito em < 1,5 s p95 local; testes verdes |
| **3** | UX & PWA | Telas 1 e 2 completas (Material You); selos de confiança; base fria degradada; manifest + install; escaneamento de NFC-e no app; dica preditiva (heurística + adapter Vigil) | Teste com 5 pessoas reais: primeiro veredito em < 60 s sem ajuda |
| **4** | B2B, prova & demo | Tela 3 (painel lojista com dados reais agregados); slot patrocinado + toggle "desligar anúncios"; `/transparencia`; tool para agentes; `DEMO_MODE`; ensaio da demo 10× | Demo de 2 min sem falha 3× seguidas, incluindo modo avião (fallback) |

**Corte de escopo se atrasar (em ordem):** pins na rota → painel SaaS (mock estático) → cashback (só a auditoria, sem pagamento) → entrada por voz. **Nunca cortar:** NFC-e, normalização com avaliação, veredito com custo de deslocamento, selos de confiança, prova de neutralidade.

---

## 5.4 Riscos técnicos & mitigações

| Risco | Prob. | Impacto | Mitigação prática |
|-------|-------|---------|-------------------|
| **Captcha / instabilidade das páginas da Sefaz** | Alta | Alto | Validar chave localmente (DV) antes do crawl; parser só da UF piloto; fila com retry escalonado; fallback de foto do cupom via Gemini (CNPJ e unicidade ainda vêm da chave); nunca resolver captcha; cachear notas já consultadas. |
| **Encartes não estruturados** (imagem, PDF, layout criativo) | Alta | Médio | Firecrawl com extração por schema; se falhar, enviar a imagem/PDF direto ao Gemini multimodal com o mesmo schema; marcar preços condicionais; confiança base menor que NFC-e. |
| **Match errado de SKU** (comparar produtos diferentes) | Média | **Crítico** | Cascata com LLM escolhendo entre candidatos; regras rígidas de unidade/tamanho por regex; limiar 0,9 para comparação cross-brand; golden set no CI; quarentena revisável. |
| **Falta de histórico para predição** | Alta | Baixo | A predição é só uma dica, nunca o veredito; heurística por calendário de encartes; Vigil Labs atrás de adapter; mostrar fonte e confiança da dica. |
| **Base fria fora do bairro-piloto** | Alta | Alto | Estratégia supply-first num bairro; veredito degradado e honesto; loop de contribuição incentivado por cashback. |
| **Custo de APIs (Maps/Gemini)** | Média | Médio | Pré-filtro geodésico; Routes só para 10 finalistas; cache H3 + hora; modelo Flash; rate limit; orçamento com alerta no Billing. |
| **Fraude no crowd/cashback** | Média | Médio | Reputação do autor calibrada por NFC-e; geofence de 300 m; UNIQUE por chave + oferta; cashback só com consulta Sefaz bem-sucedida. |
| **Rede instável na demo** | Média | **Crítico** | `DEMO_MODE` com base semeada, respostas Gemini/Routes gravadas para a lista de demo, vídeo de backup de 2 min. |
| **Percepção de ranking comprado** | Média | Alto | Seção 3.6 inteira: arquitetura, role de banco, teste de invariância, hash público, toggle ao vivo. |

---

## 5.5 Comércio agêntico: o veredito como *tool*

O veredito é uma resposta estruturada e verificável — ideal para agentes (Gemini, assistentes, apps de terceiros). Expor um endpoint de cotação de cesta com contrato estável e descritivo, publicável como ferramenta MCP / função de agente e **alinhado ao Universal Commerce Protocol (UCP)** do Google para comércio agêntico (mapear os campos para a especificação UCP vigente ao implementar):

```json
{
  "name": "quote_basket",
  "description": "Retorna onde uma lista de compras sai mais barata perto de um ponto, considerando preço, deslocamento e tempo. O ranking é neutro (não influenciado por anúncios) e verificável por ranking_hash.",
  "input_schema": {
    "type": "object",
    "properties": {
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "text": { "type": "string", "description": "texto livre do item, ex: 'leite integral 1L'" },
            "gtin": { "type": "string" },
            "quantity": { "type": "number", "default": 1 },
            "brand_required": { "type": "boolean", "default": false }
          },
          "required": ["text"]
        }
      },
      "location": {
        "type": "object",
        "properties": { "lat": { "type": "number" }, "lng": { "type": "number" } },
        "required": ["lat", "lng"]
      },
      "radius_m": { "type": "integer", "default": 3000, "maximum": 10000 },
      "travel_mode": { "type": "string", "enum": ["DRIVE", "WALK", "BICYCLE", "TRANSIT"], "default": "DRIVE" },
      "max_stores": { "type": "integer", "enum": [1, 2], "default": 2 }
    },
    "required": ["items", "location"]
  }
}
```

A resposta é o contrato da Seção 2.3. Narrativa para o Google: **"todo mercadinho de bairro passa a existir para agentes de compra, sem integrar nada — basta uma nota fiscal escaneada."**

---

## 5.6 Roteiro da demo de 2 minutos

> Preparação: celular real espelhado; `DEMO_MODE=true` como rede de segurança; bairro-piloto semeado; uma lista em papel manuscrita de verdade (~25 itens); uma NFC-e física de compra recente.

| Tempo | Ação na tela | Fala (resumo) |
|-------|--------------|---------------|
| **0:00–0:15** | Slide único: foto de uma pessoa com lista de papel no mercado | "Toda família compara preço de mercado item a item — ou desiste. Ninguém responde: *onde minha lista inteira sai mais barata, perto de mim, hoje, contando a gasolina e o tempo?*" |
| **0:15–0:40** | Fotografar a lista de papel → chips aparecem; corrigir 1 chip com 1 toque | "Gemini multimodal lê caligrafia, expande 'lt' para leite, separa marca exigida de 'qualquer uma'." |
| **0:40–1:05** | Veredito: "Assaí + Sacolão Rua 7 · R$ 303,24 · economiza R$ 17,86"; abrir "Por que não só uma loja?"; selos "Pago por 4 pessoas · há 1 h" | "Places e Routes calculam o custo real do trajeto. Só mandamos dividir quando compensa. E todo preço diz de onde veio." |
| **1:05–1:20** | Escanear a NFC-e física → "Você atualizou 23 preços para 412 vizinhos" + cashback auditado | "Cada nota fiscal é uma prova com CNPJ e horário. Firecrawl lê a Sefaz e os encartes; a comunidade mantém fresco." |
| **1:20–1:35** | Toggle "Desligar anúncios" → veredito e `ranking_hash` idênticos | "O ranking nunca é vendido. Não é promessa: o motor não tem acesso aos anúncios, e o hash prova." |
| **1:35–1:50** | Tela do lojista: "18 % dos vereditos ganhos; perde no arroz 5 kg por R$ 2,10" | "O lojista paga por intenção local e por cashback auditado — e a única forma de ganhar o veredito é baixar o preço." |
| **1:50–2:00** | Mostrar chamada `quote_basket` feita por um agente | "E qualquer agente de compras pode perguntar isso pra gente. É o mercadinho de bairro entrando no comércio agêntico — em Gemini, Maps e GCP." |

**Plano B:** se a rede cair, `DEMO_MODE` serve as respostas gravadas; se o celular falhar, vídeo de 2 min gravado no ensaio final.

**Números para ter na ponta da língua:** nº de lojas e observações na base, precisão de SKU no golden set, p95 do veredito, economia média em cestas reais do time.
