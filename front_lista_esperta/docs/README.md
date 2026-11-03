# Lista Esperta — Relatório Técnico Executivo

> **Onde minha lista inteira sai mais barata, perto de mim, hoje, contando o custo de ir até lá?**
>
> Hackathon hack.br · Patrocinadores-núcleo: Google (Gemini + Maps Platform), Firecrawl, Vigil Labs, Vibe Space.

Este diretório é a fonte da verdade de arquitetura, produto e execução do MVP. Cada seção é independente e pode ser lida por quem vai implementá-la.

| # | Seção | Para quem | Entregável principal |
|---|-------|-----------|----------------------|
| 1 | [Arquitetura de Dados & Pipeline de Ingestão](01-arquitetura-dados-ingestao.md) | Backend / Dados | Schema PostGIS, pipeline das 3 fontes, normalização de SKU com Gemini |
| 2 | [Motor de Decisão & Veredito](02-motor-de-decisao.md) | Backend / Algoritmos | Função de custo total, otimizador 1–2 lojas, camada preditiva |
| 3 | [Monetização B2B & "Google Ads Físico"](03-monetizacao-b2b.md) | Produto / Negócios / Backend | 4 pilares de receita + prova técnica de neutralidade |
| 4 | [UX/UI & Redução de Atrito](04-ux-ui.md) | Produto / Front | 3 telas, estados de base fria, selos de confiança |
| 5 | [Roadmap MVP, Riscos & Demo](05-roadmap-mvp-riscos-demo.md) | Todos | Stack, sprint de 4 semanas, riscos, roteiro da demo de 2 min |

---

## Sumário executivo (1 minuto de leitura)

**O problema.** O consumidor brasileiro compara preço item a item (cansativo) ou não compara (caro). Nenhum produto responde à pergunta sobre a **cesta inteira** com **custo de deslocamento** e **dados de hoje**.

**A tese.** O ativo não é o app, é a **base de preços hiper-local auditável**: cada nota fiscal eletrônica (NFC-e) escaneada é uma observação de preço *com CNPJ, data/hora e item*. Encartes (Firecrawl) dão cobertura; NFC-e dá prova; a comunidade dá frescor. Gemini transforma texto sujo em SKU canônico; Maps transforma lojas em custo real de rota.

**O produto em uma frase.** Foto da lista → em ~5 s: *"Vá ao Atacadão (R$ 287,40, 2,1 km). Dividir com o Hortifruti da esquina economiza mais R$ 14 — vale a pena."*

**Diferenciais defensáveis.**
1. **Custo total, não preço:** `Σ preços + km × R$/km + minutos × R$/min + custo fixo por parada`.
2. **Recomendação híbrida só quando compensa:** divisão em 2 lojas exige economia acima de um limiar (sem "otimização de centavos").
3. **Confiança explícita:** todo preço mostra fonte, idade e nº de confirmações ("visto há 1 h por 4 pessoas").
4. **Neutralidade provável:** o ranking é uma função pura sem acesso a dados de anúncio, com hash auditável por veredito e teste automatizado de invariância.

**Monetização ("Google Ads físico").** CPC de intenção local, cashback de marca auditado por NFC-e, painel SaaS de demanda regional (dados agregados k-anônimos) e pins patrocinados no corredor da rota — sempre em slots rotulados, nunca dentro do ranking.

**Por que interessa ao Google.** É um caso de uso nativo de **Gemini multimodal + Places + Routes**, e o veredito é exposto como *tool* para agentes (alinhado a comércio agêntico / Universal Commerce Protocol): qualquer agente pode perguntar "onde compro esta lista?" e receber uma resposta estruturada e verificável.

---

## Estado atual do repositório

- `front_lista_esperta/` — Next.js 16.4 com as 3 telas das Seções 4.2 (lista, veredito, lojista), o motor da Seção 2 (`lib/verdict/`, testado), a prova de neutralidade da Seção 3.6 (lint, teste de invariância, `ranking_hash`, "Ver sem anúncios") e a validação de chave NFC-e da Seção 1.2. **Os preços, lojas e listas do painel são simulados** (`lib/demo/`); a ingestão real e o PostGIS seguem o roadmap da Seção 5.3.
- Como rodar: ver [../README.md](../README.md).

## Convenções deste relatório

- Valores monetários e parâmetros (R$/km, valor do tempo, preços de CPC) são **hipóteses iniciais** a calibrar com dados reais — estão marcados como tal.
- Nomes exatos de endpoints/modelos de terceiros (Firecrawl, Vigil Labs, versão do Gemini) mudam com frequência: o código de exemplo isola cada provedor atrás de um *adapter* e lê identificadores de variáveis de ambiente. **Valide contra a documentação vigente do patrocinador antes de codar.**
