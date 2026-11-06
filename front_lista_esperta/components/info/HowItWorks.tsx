/** "Como calculamos": the whole rule, short enough for a panel (D-069, D-070, D-072). */
const STEPS = [
  "Monte a lista: digite, cole, tire foto ou toque na lupa para ver os menores preços na internet.",
  "Toque em “Ver onde comprar” e diga de onde você sai: localização do celular ou um endereço.",
  "Escolha até quantos km quer ir. Mostramos as lojas nesse raio, da lista mais barata para a mais cara, no mapa e na lista.",
];

const RULES: [string, string][] = [
  ["Total da lista", "a soma dos preços de cada item naquela loja, vezes a quantidade"],
  ["Item que a loja não tem", "entra pelo preço mediano das lojas por perto, para a comparação ser justa"],
  ["Empate", "ganha a loja mais perto de você"],
  ["Duas lojas", "só sugerimos dividir a compra se economizar mais de R$ 10 e mais de 5%"],
  ["Lojas fechadas", "ficam de fora quando a loja informa o horário"],
  ["Distância", "rota de carro (ou estimativa); aparece para você decidir, mas não muda o preço"],
];

const SOURCES: [string, string][] = [
  ["Nota fiscal", "o preço que alguém pagou de verdade. É o mais confiável e vale por 7 dias."],
  ["Loja", "o preço informado pelo lojista. Vale por 30 dias."],
  ["Encarte", "a oferta publicada pela loja, até a validade."],
  ["Clientes", "preço visto na prateleira. Só entra quando não há nada melhor."],
  ["Internet", "os menores preços do Google em lojas online da sua cidade. Só como referência: não entram no ranking."],
];

function Terms({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-2 divide-y divide-line">
      {rows.map(([term, value]) => (
        <div key={term} className="py-2.5">
          <dt className="font-medium">{term}</dt>
          <dd className="text-ink-soft">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HowItWorks() {
  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="hiw-steps">
        <h3 id="hiw-steps" className="text-lg font-bold">
          Como funciona
        </h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-ink-soft">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="hiw-rules">
        <h3 id="hiw-rules" className="text-lg font-bold">
          A conta
        </h3>
        <p className="mt-2 rounded-md bg-surface-sunken px-3 py-2 font-medium">
          total = preço dos itens na loja + itens que ela não tem (pela mediana da região)
        </p>
        <Terms rows={RULES} />
      </section>

      <section aria-labelledby="hiw-sources">
        <h3 id="hiw-sources" className="text-lg font-bold">
          De onde vêm os preços
        </h3>
        <p className="mt-1 text-ink-soft">Cada preço mostra a origem e quando foi visto.</p>
        <Terms rows={SOURCES} />
      </section>

      <section aria-labelledby="hiw-neutral">
        <h3 id="hiw-neutral" className="text-lg font-bold">
          O ranking não está à venda
        </h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft">
          <li>A ordem das lojas vem só do preço. Nenhuma loja paga para subir.</li>
          <li>Conteúdo patrocinado aparece num bloco separado, marcado como “Patrocinado”.</li>
          <li>Lojistas veem só números agregados da procura na região, nunca quem você é.</li>
        </ul>
      </section>
    </div>
  );
}
