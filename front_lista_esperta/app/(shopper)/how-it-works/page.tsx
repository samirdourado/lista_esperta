import type { Metadata } from "next";
import { brl } from "@/lib/format";
import {
  ALGO_VERSION,
  COST_PER_KM,
  DETOUR_FACTOR,
  FALLBACK_FACTOR,
  RISK_LAMBDA,
  SPLIT_MIN_ABS,
  SPLIT_MIN_PCT,
  STOP_OVERHEAD_MIN,
  TRANSIT_FARE,
  VALUE_PER_MIN,
} from "@/lib/verdict/params";

export const metadata: Metadata = { title: "Como calculamos" };

const pct = (n: number) => `${Math.round(n * 100)} %`;

export default function HowItWorksPage() {
  const params: Array<[string, string]> = [
    ["Custo por km de carro", `${brl(COST_PER_KM.DRIVE)} (combustível e desgaste)`],
    ["Ônibus ou metrô", `${brl(TRANSIT_FARE)} por trecho, ida e volta`],
    ["Valor do seu tempo", `${brl(VALUE_PER_MIN)} por minuto (${brl(VALUE_PER_MIN * 60)} por hora)`],
    ["Tempo por parada", `${STOP_OVERHEAD_MIN} min para estacionar, fila e caixa`],
    ["Distância de rua", `linha reta × ${DETOUR_FACTOR.toLocaleString("pt-BR")}`],
    ["Item sem preço na loja", `preço da região + ${pct(FALLBACK_FACTOR - 1)}`],
    ["Preço pouco confiável", `conta até ${pct(RISK_LAMBDA)} mais caro na escolha`],
    ["Para sugerir duas lojas", `economia de pelo menos ${brl(SPLIT_MIN_ABS)} ou ${pct(SPLIT_MIN_PCT)} da compra`],
  ];

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pt-8 pb-20">
      <h1 className="font-display text-[clamp(2.4rem,10vw,3.4rem)] leading-[0.95] font-bold tracking-tight">
        Como calculamos
      </h1>
      <p className="mt-3 text-ink-soft">
        O veredito escolhe o plano de menor custo total. A conta é pública e a mesma para todo mundo.
      </p>

      <section className="mt-10" aria-labelledby="formula">
        <h2 id="formula" className="font-display text-3xl font-bold">
          A conta
        </h2>
        <p className="mt-3 rounded-lg border border-line bg-surface px-4 py-4 text-lg leading-relaxed">
          custo total = preço dos produtos + quilômetros × custo por km + (minutos de trajeto + paradas × tempo por
          parada) × valor do seu tempo
        </p>
        <p className="mt-3">
          Comparamos todas as lojas sozinhas e todos os pares de lojas no raio que você escolheu. Só sugerimos dividir a
          compra quando a economia, já descontando o trajeto e o tempo, passa do limite abaixo.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="parametros">
        <h2 id="parametros" className="font-display text-3xl font-bold">
          Os números que usamos
        </h2>
        <table className="mt-3 w-full text-left">
          <tbody className="divide-y divide-line">
            {params.map(([k, v]) => (
              <tr key={k}>
                <th scope="row" className="py-2.5 pr-4 align-top font-medium">
                  {k}
                </th>
                <td className="py-2.5 text-ink-soft">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[0.9rem] text-muted">
          Versão do algoritmo: {ALGO_VERSION}. Valores iniciais, revisados com dados reais.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="origem">
        <h2 id="origem" className="font-display text-3xl font-bold">
          De onde vem cada preço
        </h2>
        <ul className="mt-3 space-y-3">
          <li>
            <strong>Confirmado:</strong> veio de uma nota fiscal escaneada ou foi visto por 3 ou mais pessoas nas
            últimas 24 horas.
          </li>
          <li>
            <strong>Encarte:</strong> anunciado pela loja no folheto da semana. Pode exigir quantidade mínima ou cartão
            da loja.
          </li>
          <li>
            <strong>Comunidade:</strong> uma ou duas pessoas fotografaram a etiqueta recentemente.
          </li>
          <li>
            <strong>Estimativa:</strong> não temos o preço nessa loja e usamos o da região, com acréscimo.
          </li>
        </ul>
        <p className="mt-3">
          Preços mais antigos valem menos: a confiança cai pela metade a cada 3 dias para notas fiscais e a cada dia
          para relatos da comunidade.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="anuncios">
        <h2 id="anuncios" className="font-display text-3xl font-bold">
          Por que anúncios não compram o ranking
        </h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5">
          <li>
            O cálculo do veredito não tem acesso aos dados de anúncios. O projeto não compila se alguém tentar ligar os
            dois.
          </li>
          <li>
            O veredito fica pronto antes de qualquer anúncio ser escolhido. Anúncios só aparecem na área marcada como
            Patrocinado.
          </li>
          <li>Testes automáticos conferem que anúncios não mudam nenhum veredito.</li>
          <li>
            Cada veredito tem um código de verificação calculado só com a lista, o local e os preços. Use &ldquo;Ver sem
            anúncios&rdquo; na tela do veredito: o resultado e o código continuam iguais.
          </li>
        </ol>
      </section>
    </div>
  );
}
