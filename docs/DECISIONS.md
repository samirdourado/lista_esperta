# Decisões

Registro de decisões tomadas onde a especificação era ambígua ou conflitava com o ambiente. A mais recente fica no topo de cada fase.

## Ajustes depois da fase 8

### D-075 · Localização certa logo de cara, e só lojas com produtos da lista
- **Pedida ao abrir:** "Ver onde comprar" já pede a localização. Não precisa tocar em botão se houver um lugar confiável salvo no aparelho: um CEP ou endereço digitado, ou um GPS com precisão de até 1 km.
- **Várias leituras:** o app escuta o aparelho por até 15 s (`watchPosition`, alta precisão, sem cache) e fica com a leitura mais precisa. Para antes se ela chegar a 100 m. No celular, a primeira resposta costuma vir da rede, e o GPS vem segundos depois.
- **Estimativa larga nunca é usada sozinha:** computadores sem GPS, e celulares com GPS desligado, só sabem a região pelo Wi-Fi ou pelo IP (±2,5 km no teste). Isso não basta para comparar lojas a poucos km.
  - Com margem acima de 1 km, a tela pede o **CEP**, que fica salvo para as próximas vezes.
  - Ela também oferece "Tentar a localização de novo" e "Usar a região aproximada mesmo assim".
  - Uma estimativa nunca fica salva.
- **Busca por CEP**, para qualquer CEP, sem nenhum valor fixo no código. O `GET /geocoding/search` reconhece 8 dígitos, com ou sem traço.
  - Rua e bairro vêm da BrasilAPI (CEP v2).
  - As coordenadas vêm do Nominatim, buscando "rua, cidade, UF" e, se não achar, "bairro, cidade, UF". A coordenada que a BrasilAPI devolve costuma ser o centro da cidade, por isso não é usada.
  - Um CEP com um só resultado é aceito na hora.
- **Só lojas com produtos da lista:** saiu o `unpricedStores` (D-073). O veredito e o mapa mostram só lojas que têm preço para ao menos um item.
  - Cada loja mostra nome, endereço, distância e o preço da lista ali.
  - As lojas do OpenStreetMap sem preço não aparecem mais, como a concessionária do teste.

### D-074 · Resultados do Google ficam abertos para adicionar vários
Cada busca gasta 1 das 250 do mês. Por isso a caixa de resultados continua aberta depois de adicionar um item, para dar para escolher outros da mesma busca sem pesquisar de novo.
- **Quando fecha:** só no ×, no Esc, ao apagar o texto do campo ou ao tocar fora dela.
- **Item adicionado:** o carrinho vira um ✓ num círculo verde (`--success`). Tocar de novo não duplica, e o leitor de tela anuncia "Já está na lista".
- **Nova busca:** as marcações recomeçam do zero.

### D-073 · Veredito com seletor de distância e mapa; localização mais precisa
- **Distância:** um seletor deslizante de 0,5 a 10 km, em passos de 0,5. O número acompanha o dedo, e a busca só roda 0,4 s depois que a pessoa solta. Começa em 0,5 km e não em 0, porque um raio zero não encontra loja.
- **Lista e mapa:** no desktop ficam lado a lado e, no celular, o mapa vem em cima.
  - **Mapa:** mostra o raio como um círculo tracejado e cada loja com preço com o total da lista em cima do ponto. Tocar num ponto destaca a loja na lista, e tocar na loja da lista destaca o ponto.
- **Lojas sem preço** (revertido em D-075): o veredito passa a devolver as lojas abertas do raio que ainda não têm preço para nenhum item (`unpricedStores`, as 60 mais perto, e o total em `params.storesWithoutPrices`). Elas aparecem em cinza no mapa e numa lista recolhida.
  - Sem isso, quem mora longe das lojas com preço via uma tela vazia. Era o caso do CEP 04760-040: as lojas demo ficam a cerca de 10 km dali, e as lojas reais da região, vindas do OpenStreetMap, ainda não têm preço.
- **Localização:** "Usar minha localização" pede uma leitura nova (`maximumAge: 0`) e precisa (`enableHighAccuracy`). Antes o navegador podia devolver uma posição guardada ou estimada pelo IP.
  - O app mostra a rua e o bairro encontrados (Nominatim), para a pessoa conferir.
  - Quando a precisão passa de 500 m, avisa e sugere digitar o endereço.

### D-072 · Menos telas: Lojas, Enviar nota e Como calculamos
Saíram as páginas `/stores`, `/receipts/import` e `/how-it-works`, e a barra de abas do celular. A página de lojas mostrava estabelecimentos sem preço, e o foco do app é onde a lista sai mais barata.
- **Painéis na tela principal:** Enviar nota e Como calculamos abrem num painel (`<dialog>` nativo), que vem de baixo no celular e da direita no desktop.
- **Endereço do painel:** fica na URL (`?painel=nota`, `?painel=como-calculamos`). Assim um link de qualquer tela abre o painel, e o botão voltar fecha.
- **Endereços antigos:** redirecionam para esses painéis e para `/verdict`.
- **Como calculamos:** o texto foi reescrito para a regra atual: o preço da lista, a mediana para o que falta, o desempate pela distância e o Google só como referência.
- **Busca no Google:** os resultados mostram só a foto, o nome e o preço.

### D-071 · Tema claro como padrão
O app abre sempre no tema claro, mesmo com o aparelho no modo escuro. O botão da lua liga o escuro, e a escolha fica salva no aparelho (`le-theme`). Antes, o padrão seguia o sistema e o botão tinha três estados. O mapa segue a mesma regra.

### D-070 · Menores preços do Google ao montar a lista (SerpApi)
Ao digitar um produto e tocar em Pesquisar, a API (`GET /web-prices`) busca no Google Shopping pelo SerpApi, na cidade de quem pesquisa, e devolve até 6 ofertas: entre as 20 mais relevantes, as mais baratas primeiro, sem repetir a mesma loja e o mesmo título.
- **Cidade:** a localização vira cidade pelo Nominatim, e a cidade vira o nome de lugar do Google pela Locations API do SerpApi, que é grátis. Sem localização, a busca vale para o Brasil todo.
- **Cota:** o plano grátis dá 250 buscas por mês. A API guarda cada resposta por 6 horas e limita a 10 buscas por hora por cliente. Sem a chave, a resposta é `503 WEB_SEARCH_UNAVAILABLE`; com a cota esgotada, `429 WEB_SEARCH_QUOTA`.
- **O que entra na lista:** o item vai com o título do Google e um `webPrice` (preço, loja, link, data), que aparece como "Na internet: R$ X em Loja". Ele é **só referência e não entra no ranking**. Os preços do Google são quase sempre de lojas online, e o veredito compara os mercados físicos perto da pessoa.
- **Tela:** é um combobox. O campo controla a lista de resultados, as setas e o Enter escolhem, e o Esc fecha. Cada resultado mostra foto, nome, loja, preço e o ícone de carrinho.

### D-069 · O veredito ordena só pelo preço da lista
A pedido do produto, saíram o custo por km e o valor da hora: da tela, da conta, da API (`costPerKm`, `valuePerHour` e `travelCost`) e do banco (colunas removidas na migration `20261106000000_simple_verdict_web_prices`). Agora:
- `totalCost` é o preço dos itens mais a mediana da região para os que a loja não tem;
- entram as lojas dentro do raio escolhido;
- em caso de empate, ganha a mais perto;
- a distância de ida e volta continua aparecendo;
- a divisão em duas lojas segue os mesmos limites (mais de R$ 10 e mais de 5%), agora só pelo preço.

## Publicação para testes

### D-068 · Vercel + Render + Neon, com a API atrás do próprio front
Para testar online de graça: o front fica na Vercel, a API no plano free do Render (Docker, `render.yaml` na raiz) e o banco no Neon. O Neon tem plano gratuito com PostGIS e `pg_trgm`, e a hospedagem compartilhada da TurboCloud não roda Docker nem PostgreSQL.

**O navegador só fala com o front.** Com `API_PROXY_TARGET` definido, o Next repassa `/api/v1/*` e `/uploads/*` para o Render. Chamar `onrender.com` direto não funcionaria, por três motivos:
- `vercel.app` e `onrender.com` são sites diferentes, então os cookies de sessão seriam de terceiros; Safari e Chrome com proteção contra rastreamento os bloqueiam.
- O `proxy.ts` decide o acesso a `/merchant`, `/admin` e `/account` olhando o cookie `le_access` no domínio do front.
- Os cookies `SameSite=lax` não iriam em chamadas entre sites.

Com o repasse, nada muda nos cookies nem no CORS.

**IP de quem acessa:** os limites de tentativa usam o IP. Atrás do balanceador do Render e do repasse da Vercel, `TRUST_PROXY_HOPS=2` faz o Express ler o IP do `X-Forwarded-For`. O padrão é 0, para que ninguém forje o IP rodando local.

**Imagem de produção:** é o `back_lista_esperta/Dockerfile`, que compila o Nest e, ao subir, roda `prisma migrate deploy` e depois `node dist/main`. O `node_modules` vai inteiro porque o CLI do Prisma é dependência de desenvolvimento.

**Limites do plano free, aceitos para testes:**
- A API dorme depois de 15 minutos sem uso, e o primeiro acesso leva cerca de 1 minuto. Nesse intervalo o verificador de alertas não roda.
- O disco do Render é apagado a cada deploy, então as fotos enviadas somem. Os dados extraídos ficam no banco.
- A Vercel pode limitar o tamanho de envio pelo repasse. As fotos aceitas pela API vão até 5 MB.

## Fase 8

### D-067 · Aviso de navegação instantânea no dev (pendência pequena)
Com Cache Components, o `next dev` mostra "Could not validate that a segment in your UI has instant navigation" nas páginas de uma loja do painel (`/merchant/stores/[storeId]/*`), desde a fase 5. É um aviso de desenvolvimento (nível `warning`) sobre o layout que lê o `storeId` da URL. Não muda o comportamento nem aparece no build. Fica para quando o projeto adotar o Partial Prefetching.

### D-066 · Painel do admin
`/admin` tem quatro abas, com o número de pendências em cada uma:
- visão geral;
- reivindicações de loja;
- lojas com CNPJ para conferir;
- catálogo.

Nas lojas, o registro da Receita Federal (`companyData`) aparece lado a lado com o cadastro, com cada conferência (ativo, estado, cidade, CEP, nome). No catálogo:
- **Produtos para confirmar:** aliases com confiança < 0,8, com o texto da nota ou do encarte, a loja, quantas vezes apareceu e a sugestão do modelo. "É esse produto", "É outro produto" (busca no catálogo) ou "Recusar". Aprovar cria na hora os preços das notas e dos encartes que esperavam por aquele alias, uma vez só por nota ou encarte, e marca as linhas como reconhecidas.
- **Recusar** guarda o alias como `REJECTED` (valor novo do enum) em vez de apagar. Assim o mesmo texto não vai de novo para o Gemini, nem gera um produto errado na próxima nota.
- **Possíveis duplicados:** mesma unidade e tamanho, marcas compatíveis, sem códigos de barras diferentes e nome com similaridade ≥ 0,5. A mesclagem move preços, aliases, itens de listas, alertas e procura, completa marca e código de barras e apaga o duplicado. O servidor recusa tamanhos, marcas ou códigos diferentes, mesmo que alguém tente pela API.

### D-065 · Alertas de preço com Web Push próprio
Para quem tem conta (vantagem da conta, seção 3 da especificação). O alerta guarda produto, preço-alvo, ponto e raio. A cada `ALERTS_CHECK_MINUTES` (padrão 15), a API procura o menor preço atual na área com **a mesma regra do veredito** (`VerdictRepository.currentPrices`, D-055). Ela avisa quando o preço chega ao alvo e só de novo quando aparece um preço **ainda menor**. Se o preço sobe acima do alvo, o alerta se rearma.
- O envio usa Web Push com chaves VAPID geradas localmente (`npx web-push generate-vapid-keys`): sem conta em serviço de terceiros e sem custo. As chaves foram colocadas no `.env` do back. Sem elas, os alertas continuam funcionando na página `/alerts`, só sem notificação.
- Inscrições que o navegador descartou (404/410) são apagadas.
- O checador roda num `setInterval` dentro da API, sem nova dependência. Com mais de uma instância, ele iria para uma fila ou cron único.
- No aparelho, a notificação só funciona com o service worker ativo (build de produção ou `NEXT_PUBLIC_ENABLE_SW_IN_DEV=true`) e, no iPhone, com o app instalado na tela de início. A tela explica cada caso.

### D-064 · Encartes via Firecrawl
O lojista cola o link do encarte (página ou PDF) em **Encartes**, no painel da loja. O fluxo:
1. O Firecrawl (`POST /v2/scrape`, só markdown do conteúdo principal; PDFs são lidos) traz o texto.
2. O Gemini lista produto, preço e validade, com JSON validado.
3. A mesma normalização das notas fiscais liga cada item ao catálogo.

Só itens com confiança ≥ 0,8 viram preço `FLYER`, válido até o fim do último dia do encarte (horário de São Paulo), ou por 7 dias quando o encarte não diz. O resto espera o admin (D-066).

Só membros da loja importam encartes, até 5 por minuto, porque cada leitura gasta cota do Firecrawl e do Gemini. Encarte vencido, página sem texto e link que não abre são recusados com mensagem clara, e a tentativa fica registrada. Encartes só em imagem, sem texto nem PDF, não são lidos. Testado com o Firecrawl e o Gemini reais (`example.com`, que responde "sem preços").

### D-063 · Migração com nome em ordem
O `prisma migrate dev` gerou `20261105070438_…`, que ficaria **antes** de `20261105100000_merchant_catalog` (nome escrito à mão na fase 5). Num banco novo, a ordem estaria errada. A pasta foi renomeada para `20261105200000_phase8_flyers_alerts_admin`, e a linha correspondente em `_prisma_migrations` do banco de dev também.

## Fase 7

### D-060 · Item digitado → produto do catálogo, sem trocar tamanho
Quem digita "arroz 5kg" quase nunca escreve o nome do catálogo inteiro ("Arroz branco tipo 1 Camil 5 kg"). Só `similarity` do `pg_trgm` não achava, porque compara o texto inteiro. Agora a busca separa número e unidade ("5kg" → "5 kg") e aceita também `word_similarity ≥ 0,6`, que mede o item curto dentro do nome longo. Se o item digitado tem tamanho, o produto precisa ter o mesmo, em gramas ou mililitros (`sameSize` em `common/text.ts`): "arroz 1 kg" fica sem preço em vez de usar o preço do pacote de 5 kg, a mesma regra da normalização (nunca misturar tamanhos). Achado no teste real pelo navegador. Há teste unitário e e2e.

### D-059 · Neutralidade também no front
No back, o motor (`src/verdict/engine.ts`) não pode importar `sponsored/` (lint), e um teste e2e confere que um anúncio não muda o ranking. No front, os componentes do ranking em `components/verdict/` não podem importar `SponsoredBlock` (`no-restricted-imports`). Só o `VerdictView`, que monta a página, coloca os dois blocos lado a lado, e o patrocinado fica num `aside` próprio com o rótulo "Patrocinado". Hoje o `SponsoredService` devolve lista vazia: não há anunciantes.

### D-058 · Protótipo removido; foto da lista passou para a API
Saíram `lib/demo/`, `lib/verdict/*` (motor do protótipo), `lib/geo.ts`, `lib/nfce.ts`, `lib/ads/`, `lib/forecast/` (D-008) e as rotas `app/api/*` do Next. A leitura da foto da lista agora é `POST /api/v1/lists/parse-photo` no Nest, com o mesmo `GeminiService` das notas. Assim o front não guarda nenhuma chave (o `GEMINI_API_KEY` do `.env.local` do front deixou de ser usado e pode ser apagado), e isso fecha a D-009.

### D-057 · Procura anônima: uma vez por aparelho, por dia, por área
Cada veredito soma +1 lista por produto na célula de ~1 km do dia (`demand_signals`), sem ids. Para que o mesmo visitante repetindo o veredito não infle o número, o serviço guarda em memória um hash de aparelho + dia + célula e ignora as repetições. A memória zera quando a API reinicia, o que no pior caso conta a mesma pessoa duas vezes num dia. É aceitável para um sinal agregado mostrado só com k ≥ 10. Para mais de uma instância da API, isso iria para o Redis.

### D-056 · Horário de funcionamento
As lojas guardam horários por dia da semana (`openingHours`). O veredito tira do ranking as lojas **fechadas agora** (no relógio de São Paulo, UTC−3) e diz quantas ficaram de fora. Loja sem horário informado entra, com o aviso "Horário não informado". Assim uma loja do OpenStreetMap sem `opening_hours` não some da comparação.

### D-055 · Qual preço vale em cada loja
Para cada loja e produto vale a observação confiável mais recente, dentro de uma janela de validade: 7 dias para nota fiscal (NFCE) e cliente (COMMUNITY), 30 dias para preço do lojista (MERCHANT) e encarte (FLYER), porque o lojista atualiza quando muda. Uma oferta ativa do lojista ganha (é o preço da gôndola agora). O preço informado por cliente só vale quando não há outro. Cada preço volta com a origem e a idade ("visto há 2 h · 3 notas fiscais"), e o item sem preço na loja entra pela mediana da região (D-041).

### D-054 · Distância estimada sem a chave do OpenRouteService
Com `ORS_API_KEY`, o veredito pede ao OpenRouteService a matriz de distância e tempo de carro (plano gratuito). Sem a chave, ou se o serviço falhar, a distância é a linha reta × 1,3 (acréscimo médio das ruas) a 25 km/h (trânsito urbano). A tela diz qual dos dois foi usado. O resultado fica em cache por célula de ~500 m de origem, para não gastar a cota. O custo do deslocamento conta ida e volta.

## Fase 6

### D-046 · Fixture da SEFAZ-SP reconstruída (pendência)
A especificação pede "fixtures HTML reais". Não tive acesso a uma nota real, e a SEFAZ-SP fecha a conexão deste ambiente (D-047). Por isso, `test/fixtures/nfce/sp-consulta-qrcode.html` foi **reconstruída** a partir da marcação pública da página do QR Code (`#u20`, `#tabResult`, `.txtTit`, `.RCod`, `.Rqtd`, `.RUN`, `.RvlUnit`, `.valor`, `#totalNota`, `#infos`), com empresa e chave fictícias, e isso está dito no próprio arquivo.

**Para fechar a pendência:** abra o QR Code de uma nota sua no navegador, salve a página (Ctrl+S, "somente HTML") em `test/fixtures/nfce/` e adicione um caso em `receipts.spec.ts`. O Prettier não mexe nessa pasta.

### D-047 · A SEFAZ-SP recusa o cliente da API neste ambiente
Ao buscar a página do QR Code, o servidor da SEFAZ-SP fecha a conexão ("other side closed"), tanto do Docker quanto do host. O cliente se identifica honestamente (`ListaEsperta/0.1`). **Não tentei disfarçá-lo de navegador:** isso seria contornar uma proteção do órgão.

O app trata a falha: a API responde `503 SEFAZ_UNAVAILABLE` e a tela sugere enviar a foto. O caminho da foto está testado de ponta a ponta com o Gemini real.

Caminhos para ler pelo QR em produção:
1. testar de uma rede brasileira residencial ou comercial (o bloqueio pode ser por IP ou região);
2. usar um provedor pago de consulta de NFC-e atrás de `SEFAZ_FETCHER` / `NfceProvider`, como prevê a especificação;
3. pedir acesso oficial à SEFAZ.

### D-048 · Gemini: modelo, fallback e limites de confiança
- **Modelos:** o principal é `gemini-2.5-flash`. O `gemini-flash-latest` respondia 503 ("high demand") de forma persistente no plano gratuito. Fallback em ordem: `gemini-flash-lite-latest`, `gemini-3.5-flash-lite` (`GEMINI_FALLBACK_MODELS`). Cada modelo tem 2 tentativas para 429/500/503, e 404 (modelo aposentado) passa para o próximo.
- **Chamada:** a chave vai no header `x-goog-api-key`, nunca na URL. A saída é JSON estrito (`responseSchema`, temperatura 0), validado com class-validator antes de gravar.
- **Confiança:** a partir de **0,8** o alias é aprovado e o preço entra. Entre **0,5 e 0,8**, o alias fica `PENDING`, sem preço, como pede a especificação. **Abaixo de 0,5**, nenhum produto é criado e a linha fica "não reconhecida"; no teste real, "XPTO 2X LV 3" virava um "Produto Desconhecido".
- **Teste real** (com a sua chave): 6 linhas de cupom normalizadas em cerca de 7 s, por exemplo "LT LEITE ITAMBE INT 1L" → "Leite UHT Integral Itambé 1 L". O prompt exige tipo, variação, marca e tamanho. Script manual em `scripts/gemini-smoke.ts`.

### D-049 · Mesmo produto só com mesma unidade, tamanho e marca
Para reaproveitar um produto existente, a normalização exige a mesma unidade, a mesma quantidade, nome parecido (`similarity ≥ 0,6`) **e** marca compatível. O teste real casou o leite Itambé com o leite da "Marca Demo"; a regressão está coberta no e2e.

### D-050 · Mesma loja: o tipo de loja não conta
Na comparação de nomes (`nameSimilarity`), palavras como supermercado, mercado, drogaria e atacado não contam. O teste real associou a nota da "BOM PRECO SUPERMERCADOS" ao "Pastorinho Supermercados" vizinho. A loja da nota é encontrada pelo CNPJ. Sem CNPJ cadastrado, o app procura uma loja a menos de 150 m com nome parecido (≥ 0,5) e lhe dá o CNPJ; senão, cria a loja com origem `NFCE`, com o endereço geocodificado.

### D-051 · Foto exige a chave de acesso; chave sozinha só é validada
- **Foto:** a chave de 44 dígitos precisa estar legível e com o dígito verificador certo. Ela torna a nota auditável e impede contar a mesma nota duas vezes. A foto fica guardada no `StorageService` para auditoria.
- **Chave digitada:** a consulta só pela chave exige captcha na SEFAZ e o provedor pago foi dispensado. Por isso, `POST /receipts/key` valida a chave (dígito, estado, modelo, já enviada?) e pede o QR ou a foto.

### D-052 · Preço da comunidade
`POST /prices/community` é pública e exige sessão ou `X-Guest-Id`. Tem rate limit de 20/min por aparelho e 60/min por IP, e grava `source = COMMUNITY`, o peso mais baixo.

## Fase 5

### D-039 · Código de barras pelo Open Food Facts
A busca por EAN consulta primeiro o catálogo e depois o Open Food Facts, que é gratuito e sem chave (`PRODUCT_LOOKUP`, trocável). O resultado é só uma **sugestão** (nome, marca, unidade, quantidade e categoria aproximada): o lojista confere antes de cadastrar. A cobertura é boa em alimentos, higiene e limpeza e fraca em eletrônicos e construção; nesses casos, o cadastro é manual. Se o serviço falhar, a busca nunca dá erro ao lojista; o formulário simplesmente fica vazio.

### D-040 · Preço é histórico; "atual" é o último
- **Edição:** cada alteração grava uma `PriceObservation` nova (`source = MERCHANT`). O preço atual é o mais recente sem `validUntil`.
- **Oferta:** é uma observação com `validUntil`, entre agora e 90 dias à frente.
- **Retirada:** "Não vendo mais" e "Encerrar oferta" preenchem `retractedAt`, em vez de apagar, e o histórico continua auditável.

### D-041 · Mediana regional e divergência com NFC-e
- **Mediana:** é calculada com o último preço de cada **outra** loja num raio de 5 km. Valem preços do lojista e de encartes com até 30 dias, e de notas e da comunidade com até 7 dias.
- **Divergência:** uma nota de até 7 dias com valor mais de 15 % diferente do preço do lojista aparece na visão geral, como pede a especificação.

Tudo é calculado numa só consulta SQL (`PricesRepository.catalog`).

### D-042 · Procura na região: agregada, anônima, k ≥ 10
"Quantos shoppers com aquele item na lista estão no raio da loja" exigiria saber onde cada pessoa está. Em vez disso, a tabela `demand_signals` guarda apenas **contagens por produto, célula de cerca de 1 km e dia**, sem id de usuário nem de aparelho. Ela é alimentada pelo veredito da fase 7. O painel soma a célula da loja e as 8 vizinhas (cerca de 3 km) nos últimos 7 dias e mostra só produtos com pelo menos 10 listas.

### D-043 · Importação de planilha
CSV com `;` ou `,` (o Excel em pt-BR salva com `;`), cabeçalhos em português ou inglês e preço no formato "12,90" ou "12.90".
- **Cada linha é ligada ao produto** pelo código de barras (primeiro no catálogo, depois no Open Food Facts, até 50 consultas por arquivo) ou pelo nome exato.
- **Produtos novos sem código** podem ser criados se vierem as colunas categoria, unidade e quantidade.
- **Linhas com erro não bloqueiam as boas:** o relatório lista a linha e o motivo.

O limite é de 2.000 linhas e 1 MB por arquivo, com 10 importações por minuto.

### D-044 · Equipe e fotos
- **Equipe:** só o OWNER adiciona pessoas, por e-mail de uma conta de lojista existente (entra como STAFF), ou remove. A loja nunca fica sem dono. O STAFF edita preços, mas não mexe na equipe nem no CNPJ.
- **Fotos:** ficam no disco local (`uploads/`), atrás do `StorageService`, que pode ser trocado por um bucket. O tipo é conferido pelos primeiros bytes do arquivo (JPEG, PNG ou WebP), não pelo nome. Limites: 5 MB e 10 fotos por loja. Os arquivos são servidos em `/uploads/…` com `nosniff`.
- **Leitura pública:** `GET /stores/:storeId/photos` não passa pelo `StoreMemberGuard`, porque o guard protege rotas que **alteram** a loja (ver D-038).

### D-045 · Painel real no lugar do protótipo
`/merchant` lista as lojas, e `/merchant/stores/[storeId]` tem as abas Visão geral, Produtos e preços, Importar planilha, Equipe e Loja (CNPJ e fotos). O painel simulado do hackathon e `lib/demo/insights.ts` foram removidos.

**Não entrou nesta fase:** editar endereço, horário e categorias pela aba "Loja". A API já aceita (`PATCH /stores/:storeId`); falta só a tela.

## Fase 4

### D-031 · Mapas gratuitos no lugar do Google (decisão sua)
Você escolheu a opção 100% gratuita. Cada serviço fica atrás de uma interface em `src/integrations/providers.ts` e pode ser trocado por um pago numa linha do `IntegrationsModule`:

| Função | Serviço | Interface |
|---|---|---|
| Descobrir lojas | OpenStreetMap via Overpass API | `PlacesProvider` |
| Endereço ↔ coordenada | Nominatim | `GeocodingProvider` |
| CNPJ | BrasilAPI | `CnpjLookup` |
| Mapa no navegador | MapLibre GL 6 + OpenFreeMap (claro `liberty`, escuro `dark`) | — |

Nenhuma chave é necessária. O enum `StoreSource` ganhou `OSM` (o `GOOGLE_PLACES` foi mantido para uma troca futura), e `google_place_id` virou `external_id`, único junto com `source`. A migration usa `RENAME`, que preserva os dados.

### D-032 · Descoberta de lojas em segundo plano, por células
O Overpass público leva de 30 a 40 s por consulta e às vezes não responde. No teste real, uma célula de cerca de 5,5 km na Vila Mariana trouxe 658 lojas em 41 s. Por isso:
- o mapa é dividido em células de 0,05°, e cada célula é consultada uma vez e guardada em `place_discovery_cells`, que vale por 30 dias (`DISCOVERY_TTL_DAYS`);
- uma fila no processo da API busca uma célula por vez, sendo educada com o serviço gratuito, e retoma as pendentes quando a API reinicia;
- `GET /stores/nearby` responde na hora com o que já está no banco e informa `pendingAreas`; o front repete a consulta a cada 8 s, por até cerca de 3 min;
- cada pedido enfileira no máximo 16 células, as mais próximas primeiro;
- vários espelhos do Overpass são tentados em ordem (`OVERPASS_URLS`).

A fila é em memória porque há uma única instância da API. Com várias instâncias, ela deve ir para uma fila de verdade (BullMQ, pg-boss).

### D-033 · O que conta como "loja" no OpenStreetMap
Entram `shop=*` com nome, farmácias e feiras (`amenity=pharmacy|marketplace`). Ficam de fora os serviços que não vendem produtos (cabeleireiro, lavanderia, oficina, agência de viagem…). O tipo OSM é convertido para as nossas categorias (`supermarket` → `alimentos`, `hardware` → `construcao/ferramentas` etc.) em `osm.mapper.ts`.

### D-034 · Deduplicação e quem manda nos dados
- **Mesma loja:** mesmo CNPJ, ou menos de 50 m de distância com `similarity(nome) ≥ 0.4` (pg_trgm).
- **OSM não duplica:** uma loja do OSM que repete uma de outra origem não é importada.
- **Lojista vence:** quando uma loja tem lojista (`StoreMember`), as importações seguintes do OSM não sobrescrevem os dados dela.
- **Cadastro do lojista:** uma possível duplicata responde `409 POSSIBLE_DUPLICATE` com o `storeId` da loja existente. O front oferece duas saídas: "É a minha loja: pedir para administrar" ou "É outra loja: cadastrar mesmo assim" (`confirmNotDuplicate`).

### D-035 · Verificação do CNPJ e reivindicação
O CNPJ é validado primeiro pelos dígitos verificadores e depois consultado na BrasilAPI. A regra, em `verification.rules.ts`, coberta por testes:
- **Não ativo** (BAIXADA, SUSPENSA…): recusado (422).
- **Mesmo estado e cidade, mais o mesmo prefixo de CEP ou um nome parecido:** `VERIFIED`.
- **Qualquer outro caso:** `PENDING`, para o admin conferir.

Na reivindicação, se o CNPJ informado dá `VERIFIED` para aquela loja e ninguém a administra ainda, o pedido é aprovado na hora. Sem CNPJ, fica pendente para o admin.

A API de moderação (`/admin/store-claims`, `/admin/stores/pending-verification`) já existe e funciona pelo Swagger. As telas do admin são da fase 8.

### D-036 · Polling do Turbopack no Docker
O `WATCHPACK_POLLING` da fase 1 só vale para o webpack. O Next 16 usa Turbopack, e no Docker do Windows o front **não recarregava** mudanças de arquivo; na fase 1 eu só tinha testado o hot reload da API. Com `WATCHPACK_POLLING=true`, o `next.config.ts` liga `watchOptions.pollIntervalMs: 1000`. A documentação do Next recomenda essa opção só como último recurso, e um bind mount do Windows é exatamente esse caso. Agora está testado.

### D-037 · Worker do MapLibre servido por `public/`
O MapLibre 6 localiza o worker com `new URL(variável, import.meta.url)`, que o bundler não resolve. Isso causava o erro "Worker failed to load" e deixava o mapa em branco. O `postinstall` copia o worker para `public/vendor/maplibre/` (fora do git), e `loadMapLibre()` chama `setWorkerUrl()`.

### D-038 · Escopo da fase
- **Lojas por perto:** nova rota `/stores` (mapa + lista), sem login. Na barra de abas do celular, entra no lugar de "Como calculamos", que continua no cabeçalho e no rodapé. A navegação do cabeçalho agora aparece só a partir de 1024 px.
- **Fotos da loja:** ficam para a fase 5, junto com o `StorageService`.
- **Veredito:** continua com os dados simulados até a fase 7. A localização real já é usada em `/stores` e no onboarding.

## Fase 3

### D-019 · Migration inicial editada à mão
Criada com `prisma migrate dev --create-only`, com três ajustes à mão:
- as extensões `postgis` e `pg_trgm` no topo;
- `NULLS NOT DISTINCT` no único `(raw_text, store_id)` de `product_aliases`. Sem isso, aliases globais (`store_id` nulo) poderiam se repetir.
- os índices GIST (`stores_location_gix`) e GIN de trigram ficam declarados no próprio `schema.prisma` (`@@index(..., type: Gist)` / `ops: raw("gin_trgm_ops")`), gerando o mesmo SQL da especificação. Assim, o `prisma migrate diff` não acusa drift (verificado: "empty migration").

### D-020 · Prisma 7
O Prisma 7 mudou a configuração:
- a conexão fica em `prisma.config.ts`;
- o client exige driver adapter (`@prisma/adapter-pg`);
- o gerador `prisma-client` escreve em `src/generated/prisma`, que fica fora do git e é gerado no `postinstall`.

O config usa `process.env.DATABASE_URL` em vez de `env()`, porque `env()` faz o `prisma generate` falhar durante o `npm ci` do Docker, onde ainda não existe banco. Usei a versão 7.10.1: a `latest` do npm aponta para uma RC da 8.

### D-021 · Scripts de instalação do npm 11
O npm 11 bloqueia scripts de instalação por padrão. Aprovei os do Prisma (que baixa o schema engine), do esbuild e do argon2 em `allowScripts`. Neguei o `@scarf/scarf`, que é só telemetria.

### D-022 · Sessão
- **Access token:** JWT HS256 de 15 min, no cookie `le_access` (`Path=/`).
- **Refresh token:** JWT de 7 dias no cookie `le_refresh`, com `Path=/api/v1/auth`, para viajar só às rotas de auth. O banco guarda só o SHA-256, e o `jti` é o id da linha.
- **Rotação:** cada `/auth/refresh` revoga o token usado. Reapresentar um token já revogado é tratado como vazamento: todas as sessões do usuário são revogadas. Duas rotações simultâneas do mesmo token não passam juntas (`updateMany ... revokedAt: null`).
- **Login:** quando o e-mail não existe, o login ainda roda um `argon2.verify` falso, para o tempo de resposta não revelar quem tem conta.
- **Cadastro:** os e-mails são normalizados para minúsculas. O auto-cadastro só cria `SHOPPER` ou `MERCHANT`, nunca `ADMIN`.
- **Hash de senha:** argon2id com os parâmetros recomendados pela OWASP (19 MiB, t=2).

### D-023 · Proteção de rotas no front (`proxy.ts`)
`/merchant`, `/admin` e `/account` passam pelo `proxy.ts`, que consulta `GET /auth/me` repassando o cookie:
- **Sem sessão:** vai para `/login?next=…`. Como o cookie de refresh não chega ao front (ver D-022), é a tela de login que tenta renovar a sessão em silêncio pelo navegador. Se conseguir, volta direto para a página pedida.
- **API fora do ar:** falha fechada (`/login?error=unavailable`).
- **Papel errado:** volta para `/account?denied=…`.
- **Lojista sem loja:** vai para `/merchant/onboarding`.

Dentro do Docker, o servidor do Next chama a API por `API_INTERNAL_URL=http://api:3333/api/v1`.

**Produção:** front e API precisam ser do mesmo *site*, por exemplo `app.exemplo.com` e `api.exemplo.com`, para que cookies `SameSite=Lax` funcionem. Em localhost isso já vale, porque cookies ignoram a porta.

### D-024 · Admin passa no `StoreMemberGuard`
Para moderar, o admin acessa qualquer `:storeId`. O `RolesGuard` não dá passe livre implícito: cada rota lista os papéis aceitos.

### D-025 · Dois baldes de rate limit
- `ip`: 300/min por IP.
- `default`: 120/min por IP + `X-Guest-Id`.

Trocar de `guestId` não escapa do limite por IP. As rotas `/auth` apertam os dois (20/min por IP e 10/min por cliente). Os e2e desligam o limite com `THROTTLE_DISABLED=true`, exceto `throttling.e2e-spec.ts`, que testa o 429.

### D-026 · Migração guest → conta
`POST /shopping-lists/import` é idempotente pelo id local da lista (`clientId`, único por usuário). Se a lista já foi importada, vale a cópia do servidor, que passa a ser a fonte de verdade. Notas e preços enviados com aquele `guestId` passam para a conta, mas só os que ainda não têm dono. No front, as listas locais são apagadas depois da importação. Se a importação falhar, elas ficam no aparelho e são enviadas de novo no próximo login.

Quem conhece o `guestId` de um aparelho pode reivindicar as notas daquele aparelho. O risco é aceito: é um UUID aleatório que nunca sai do aparelho, a não ser no header das gravações.

### D-027 · Escopo antecipado e adiado
- **Antecipado:** `GET /stores/:storeId/members` (equipe da loja, que seria da fase 5) já existe, para exercitar `RolesGuard` + `StoreMemberGuard` nos testes.
- **Adiado:** o onboarding do lojista por enquanto só explica os passos. O cadastro e a reivindicação da loja são da fase 4.
- **Rota de teste:** o `OptionalJwtAuthGuard` é testado por uma rota que só existe nos testes, porque as rotas públicas que gravam dados chegam nas fases 6 e 7.

### D-028 · Dados do catálogo
- **Slugs das categorias:** são dados, não código, e ficam em português (`laticinios`, `construcao`), como no exemplo de saída do Gemini da especificação.
- **Unidades:** `MeasureUnit` é um enum (`UN, G, KG, ML, L, M, M2`), para a regra de nunca comparar unidades diferentes ser garantida pelo banco.

### D-029 · `/account` dentro do grupo `(shopper)`
A rota é `/account`, como pede a especificação. Fica no grupo `(shopper)` para reaproveitar o cabeçalho e a barra de abas.

### D-030 · Painel do protótipo atrás do login
`/merchant` agora exige conta de lojista. Para ver o painel de demonstração, entre com `lojista@listaesperta.dev` (criado pelo seed).

## Fase 2

### D-011 · Tokens com `light-dark()`
Cada cor é declarada uma vez (`--brand: light-dark(#0754e0, #6b9bff)`). `color-scheme: light dark` segue o aparelho, e `<html data-theme="light|dark">` força o tema. Isso evita duplicar a paleta em `@media` e em `[data-theme]`. O suporte em navegadores é amplo desde 2024. Um script inline (`THEME_BOOT_SCRIPT`) aplica a preferência salva antes da primeira pintura, seguindo o guia `preventing-flash-before-hydration` do Next 16.

### D-012 · Protótipo mantido sobre a nova base
As telas do hackathon (lista, veredito, NFC-e, painel) continuam funcionando com dados simulados, agora nas rotas em inglês e dentro do novo shell. Cada uma é reescrita na sua fase (3 a 7). Assim, sempre há algo navegável para revisar. Os tokens antigos que essas telas usam (`save`, `amber`, `tag`, `muted-soft`) viraram aliases dos novos em `@theme` e saem junto com elas.

### D-013 · Rotas renomeadas com redirecionamento
`/veredito` → `/verdict`, `/nota` → `/receipts/import`, `/lojista` → `/merchant`, `/transparencia` → `/how-it-works`. São redirects 308 em `next.config.ts`, para não quebrar links já compartilhados da demo.

### D-014 · Service worker escrito à mão
O guia do Next 16 sugere o Serwist para cache offline completo. Preferi um `public/sw.js` de cerca de 80 linhas: o requisito offline é pequeno (a última lista e o último veredito virão do IndexedDB, não do cache HTTP), e o Serwist exigiria configuração extra do Turbopack. Ele só é registrado em produção, para não esconder o hot reload. O `experimental.useOffline` do Next cobre o aviso de conexão e o retry de navegação.

### D-015 · Testes de componente em jsdom por arquivo
O Vitest 5 removeu `environmentMatchGlobs`. O ambiente padrão continua `node` (testes de `lib/`), e cada `*.test.tsx` declara `// @vitest-environment jsdom`.

### D-016 · `typecheck` roda `next typegen`
Os tipos `PageProps<"/rota">` / `LayoutProps` são gerados pelo Next. `npm run typecheck` executa `next typegen && tsc --noEmit`, para não depender de um `next dev` ou `next build` anterior.

### D-017 · Mobile: barra de abas no rodapé
No celular, a navegação principal fica numa barra fixa com 3 abas (Minha lista, Enviar nota, Como calculamos), ao alcance do polegar. A partir de 768 px, os mesmos links ficam no cabeçalho. "Tenho uma loja" aparece sempre no cabeçalho e no rodapé, como pede a especificação. "Entrar" só entra na fase 3, junto com as telas de login.

### D-018 · Timeout maior no e2e do backend
O e2e do back falhou duas vezes com "2 skipped", sempre logo depois de muitas alterações de arquivo, com os containers recompilando. Forçar `--hookTimeout=50` reproduz exatamente esse sintoma, então a causa provável é o `beforeAll` (subida do Nest) passar dos 10 s padrão sob carga. `vitest.config.e2e.ts` agora usa `hookTimeout: 30_000` e `testTimeout: 15_000`.

## Fase 1

### D-001 · O front permanece em `front_lista_esperta/`
O Next.js já estava nessa pasta, então não houve `git mv`.

### D-002 · Backend usa Vitest em vez de Jest
O NestJS 12 (`@nestjs/cli 12.0.11`) gera projetos **ESM** (`"type": "module"`, `nodenext`) já configurados com Vitest. Jest com ESM exige `--experimental-vm-modules` e transformações extras, e é frágil com decorators. Como a API do Vitest é compatível com a do Jest (`describe`/`it`/`expect`, `globals: true`) e o front também usa Vitest, os dois projetos ficam com um único test runner. O e2e usa Supertest como pedido (`npm run test:e2e`).

### D-003 · ESLint + Prettier no backend, no lugar do oxlint do scaffold
A especificação pede ESLint + Prettier. Usei `typescript-eslint` com `recommendedTypeChecked` e `no-floating-promises: error`, a mesma regra que o oxlint do scaffold aplicava.

### D-004 · Validação de env com Zod
`@nestjs/config` recebe um `validate` baseado em Zod (`src/config/env.schema.ts`). O front também usará Zod (RHF), então a mesma biblioteca serve aos dois lados. Valores vazios (`KEY=`) contam como ausentes. Hoje são obrigatórias `DATABASE_URL` e `FRONTEND_URL`. `JWT_*` passam a ser obrigatórias na fase 3, quando o módulo de auth existir.

### D-005 · Comando da API no Docker
O compose roda `npm run start:docker`. Na fase 1 esse script é só `nest start --watch`. Na fase 3 ele passa a ser `prisma migrate deploy && nest start --watch`, como pede a especificação. Ficou assim porque ainda não existe schema Prisma.

### D-006 · Banco de teste no mesmo container
O script `docker/db/init/01-test-database.sh` cria `lista_esperta_test` na primeira subida do volume. Ele é montado como **arquivo** em `/docker-entrypoint-initdb.d/20-…`, sem esconder o `10_postgis.sh` da imagem. O e2e usa `DATABASE_URL_TEST` ou, na falta dela, `localhost:5433/lista_esperta_test`.

### D-007 · Polling no Docker
`WATCHPACK_POLLING=true` no web e `CHOKIDAR_USEPOLLING=true` no api, como pedido. No api também adicionei `TSC_WATCHFILE=DynamicPriorityPolling`, porque o `nest start --watch` usa o watcher do `tsc`, que ignora o Chokidar. O hot reload pelo bind mount foi testado no Windows.

### D-008 · Escopo fora da especificação
A camada preditiva (Vigil Labs, `lib/forecast`) e os pilares B2B de cashback não estão na nova especificação. Serão removidos quando as telas forem reescritas (fase 2 em diante), exceto o bloco "Patrocinado", que a seção 7 mantém.

### D-009 · `.env.example` do front
Até a fase 3, o front antigo ainda lê `GEMINI_API_KEY` etc. nas rotas `app/api/*`. O `.env.example` do front só passa para o formato da especificação (`NEXT_PUBLIC_*`) quando essas rotas forem removidas, para não quebrar a demo atual no meio do caminho.

### D-010 · `AGENTS.md` do scaffold Nest removido
Ele só divulgava o serviço pago NestJS Observe e não tinha instruções do projeto. O `AGENTS.md` do Next foi mantido, porque é regenerado pelo `next dev` e traz avisos de versão relevantes.
