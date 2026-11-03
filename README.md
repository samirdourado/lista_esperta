# Lista Esperta

> **Onde minha lista inteira sai mais barata, perto de mim, hoje, contando o custo de ir até lá?**

Projeto do hackathon **hack.br**. Um PWA que recebe a foto ou o texto da lista de compras, cruza preços das lojas num raio definido (ex.: 3 km), calcula a melhor combinação — atacarejo, varejo de bairro ou as duas — incluindo deslocamento e tempo, e devolve um veredito instantâneo com o grau de confiança de cada preço e, quando fizer sentido, uma dica preditiva ("espere até quarta para comprar carne").

## Como funciona

1. **Entrada:** foto da lista (manuscrita, print) ou texto → **Gemini multimodal** estrutura os itens.
2. **Dados de preço**, de três fontes:
   - **Encartes** de sites e PDFs, lidos pela **Firecrawl**;
   - **NFC-e** — QR Code da nota fiscal → consulta pública da Sefaz (preço pago, com CNPJ e horário);
   - **Comunidade** — fotos de etiqueta e confirmações.
3. **Normalização de SKU** com Gemini, escolhendo entre candidatos do catálogo, para não comparar produtos diferentes.
4. **Geo:** Postgres + PostGIS (lojas no raio) e **Google Maps Platform** (Places + Routes) para o custo real do trajeto.
5. **Veredito:** minimiza `Σ preços + km × R$/km + tempo × R$/min`; só sugere dividir entre 2 lojas quando a economia compensa.
6. **Predição:** **Vigil Labs** gera, no máximo, uma dica opcional — sem alterar o veredito.
7. **B2B:** CPC de intenção local, cashback de marca auditado por NFC-e, painel de demanda regional e pins na rota — sempre rotulados e **fora** do ranking, que é neutro e verificável.

## Estrutura do repositório

```
lista_esperta/
├─ README.md                 ← este arquivo
└─ front_lista_esperta/      ← PWA Next.js 16 (front + BFF)
   ├─ app/                   ← rotas (App Router)
   ├─ docs/                  ← relatório técnico executivo completo
   └─ README.md              ← detalhes do projeto Next
```

## Como rodar

Pré-requisitos: **Node.js 20.9+** (testado com Node 24) e npm.

```bash
cd front_lista_esperta
npm install
cp .env.example .env.local   # opcional por enquanto; necessário para Gemini/Maps/Firecrawl/Vigil
npm run dev
```

Abra <http://localhost:3000>, toque em **Usar uma lista de exemplo** e depois em **Ver onde comprar**. Build de produção: `npm run build && npm run start`. Lint: `npm run lint`. Testes: `npm test`.

Detalhes (variáveis de ambiente, banco PostGIS local via Docker, teste como PWA no celular): [front_lista_esperta/README.md](front_lista_esperta/README.md).

## Documentação

O relatório técnico executivo está em [front_lista_esperta/docs/](front_lista_esperta/docs/README.md):

1. [Arquitetura de Dados & Pipeline de Ingestão](front_lista_esperta/docs/01-arquitetura-dados-ingestao.md): fontes, schema PostGIS, prompts Gemini
2. [Motor de Decisão & Veredito](front_lista_esperta/docs/02-motor-de-decisao.md): custo total, atacado vs. varejo, camada preditiva
3. [Monetização B2B & "Google Ads Físico"](front_lista_esperta/docs/03-monetizacao-b2b.md): 4 pilares e prova de neutralidade do ranking
4. [UX/UI & Redução de Atrito](front_lista_esperta/docs/04-ux-ui.md): 3 telas, base fria, confiança do dado
5. [Roadmap MVP, Riscos & Demo](front_lista_esperta/docs/05-roadmap-mvp-riscos-demo.md): stack, sprint de 4 semanas, roteiro da demo de 2 minutos

## Patrocinadores-núcleo

| Patrocinador | Papel no produto |
|--------------|------------------|
| Google | Gemini multimodal (listas, cupons, SKUs) · Maps Platform (Places, Routes, Maps JS) · GCP (Cloud Run, Cloud SQL, Pub/Sub) |
| Firecrawl | Leitura de encartes (HTML/PDF) e das páginas de consulta da NFC-e |
| Vigil Labs | Engine preditiva de preço |
| Vibe Space | Desenvolvimento agêntico acelerado |

## Status

Fase atual: frontend das 3 telas pronto (lista → veredito → painel do lojista, mais envio de NFC-e e transparência), com o motor de veredito real e testado rodando sobre preços **simulados** do bairro-piloto (Vila Mariana, SP). Leitura de foto via Gemini funciona com `GEMINI_API_KEY`. Próximo passo: Semana 1 do roadmap — schema PostGIS e ingestão real (Firecrawl + NFC-e) no lugar de `lib/demo/`.
