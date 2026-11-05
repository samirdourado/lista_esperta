import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Como calculamos" };

/** Defaults of the API (back_lista_esperta: verdict and prices modules). */
const PARAMS: [string, string][] = [
  ["Distância padrão", "até 5 km de você (você escolhe de 1 a 10 km)"],
  ["Custo por km", "R$ 1,00 por km rodado, ida e volta (você pode mudar)"],
  ["Valor do seu tempo", "zero por padrão; se você informar, entra na conta"],
  ["Item que a loja não tem", "conta o preço mediano das lojas por perto"],
  ["Duas lojas", "só sugerimos dividir se economizar mais de R$ 10 e mais de 5 %"],
  ["Lojas fechadas", "ficam de fora quando a loja informa o horário"],
  ["Distâncias", "rotas de carro (OpenRouteService) ou estimativa em linha reta + 30 %"],
];

const SOURCES: [string, string][] = [
  ["Nota fiscal (NFC-e)", "o preço que alguém realmente pagou. É o dado mais confiável e vale por 7 dias."],
  ["Loja", "o preço informado pelo lojista, marcado como “Preço informado pela loja”. Vale por 30 dias."],
  ["Encarte", "a oferta publicada pela loja, até a validade."],
  ["Clientes", "preço informado por quem viu na prateleira. Só entra quando não há nada melhor."],
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8">
      <PageHeading
        title="Como calculamos"
        lead="O resultado é a loja com o menor custo total para a sua lista inteira. A conta é pública e igual para todo mundo."
      />

      <section aria-labelledby="formula" className="mt-10">
        <h2 id="formula" className="text-3xl font-bold">
          A conta
        </h2>
        <p className="mt-3 rounded-md bg-surface-sunken px-4 py-3 font-medium">
          custo total = preço dos itens + itens que faltam (pela mediana) + km × R$/km + tempo × valor da sua hora
        </p>
        <dl className="mt-5 divide-y divide-line">
          {PARAMS.map(([term, value]) => (
            <div key={term} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
              <dt className="font-medium">{term}</dt>
              <dd className="text-ink-soft">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="sources" className="mt-10">
        <h2 id="sources" className="text-3xl font-bold">
          De onde vêm os preços
        </h2>
        <p className="mt-2 text-ink-soft">
          Cada preço é uma observação com data. Mostramos sempre a mais recente e confiável, com a origem ao lado, como
          “visto há 2 h · 3 notas fiscais”.
        </p>
        <dl className="mt-4 divide-y divide-line">
          {SOURCES.map(([term, value]) => (
            <div key={term} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
              <dt className="font-medium">{term}</dt>
              <dd className="text-ink-soft">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="neutral" className="mt-10">
        <h2 id="neutral" className="text-3xl font-bold">
          O ranking não está à venda
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
          <li>A ordem das lojas é calculada só pelo custo. Nenhuma loja paga para subir.</li>
          <li>Conteúdo patrocinado, quando existir, aparece num bloco separado e marcado como “Patrocinado”.</li>
          <li>Testes automáticos conferem que esse conteúdo não muda a ordem do ranking.</li>
          <li>Lojistas veem só números agregados da procura na região, nunca quem você é.</li>
        </ul>
      </section>
    </div>
  );
}
