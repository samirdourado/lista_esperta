import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { MyStoresPanel } from "@/components/merchant/MyStoresPanel";
import {
  HEATMAP,
  K_ANONYMITY,
  NEARBY_M,
  SIMULATED_LISTS,
  storeInsights,
  type StoreInsights,
} from "@/lib/demo/insights";
import { FORMAT_LABEL, STORES } from "@/lib/demo/stores";
import { brl } from "@/lib/format";

export const metadata: Metadata = { title: "Painel do lojista" };

const DEFAULT_STORE = "sup-domingos";

async function getInsights(storeId: string) {
  "use cache";
  cacheLife("hours");
  return storeInsights(storeId);
}

export default function MerchantPage({ searchParams }: PageProps<"/merchant">) {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-20">
      <h1 className="sr-only">Painel da loja</h1>
      <MyStoresPanel />
      <h2 className="mt-14 text-3xl font-bold">Desempenho na região</h2>
      <p className="mt-3 rounded-lg bg-muted-soft px-3 py-2 text-[0.95rem]">
        Prévia com {SIMULATED_LISTS} listas simuladas do bairro-piloto, enquanto o painel real chega (fase 5). Nenhum
        dado pessoal aparece aqui.
      </p>
      <Suspense fallback={<p className="mt-8 text-ink-soft">Carregando o painel…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/merchant">["searchParams"] }) {
  const sp = await searchParams;
  const requested = typeof sp.loja === "string" ? sp.loja : DEFAULT_STORE;
  const storeId = STORES.some((s) => s.id === requested) ? requested : DEFAULT_STORE;
  const data = (await getInsights(storeId))!;
  const winRate = data.listsNearby > 0 ? data.wins / data.listsNearby : 0;
  const topLoss = data.losses[0];

  return (
    <>
      <header className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-[clamp(2rem,6vw,2.8rem)] leading-none font-bold tracking-tight">
            {data.storeName}
          </h3>
          <p className="mt-2 text-ink-soft">Esta semana, num raio de {NEARBY_M / 1000} km da sua loja.</p>
        </div>
        <form className="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto" action="/merchant">
          <label htmlFor="loja" className="sr-only">
            Loja
          </label>
          <select
            id="loja"
            name="loja"
            defaultValue={storeId}
            className="min-h-tap max-w-full min-w-0 flex-1 basis-60 rounded-lg border border-line bg-surface px-3 py-2"
          >
            {STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({FORMAT_LABEL[s.format]})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-brand px-3 py-2 font-medium text-brand hover:bg-brand-soft"
          >
            Ver loja
          </button>
        </form>
      </header>

      <dl className="mt-8 grid gap-6 border-y border-line py-6 sm:grid-cols-3">
        <Stat value={data.listsNearby.toLocaleString("pt-BR")} label="listas feitas perto da sua loja" />
        <Stat
          value={`${Math.round(winRate * 100)} %`}
          label={`dos vereditos indicaram sua loja (${data.wins} ${data.wins === 1 ? "lista" : "listas"})`}
        />
        <Stat
          value={topLoss ? brl(topLoss.mine - topLoss.best) : "Nenhuma"}
          label={
            topLoss
              ? `de diferença no item em que você mais perde: ${topLoss.label}`
              : "diferença: você tem o menor preço por perto"
          }
        />
      </dl>

      <div className="mt-10 grid gap-12 lg:grid-cols-[3fr_2fr]">
        <Losses data={data} />
        <Demand data={data} />
      </div>

      <Heatmap data={data} />

      <p className="mt-12 max-w-160 text-ink-soft">
        O veredito só muda quando o preço muda: anúncios não entram no cálculo. Para ganhar mais vereditos, reduza a
        diferença nos itens acima.{" "}
        <Link href="/how-it-works" className="underline underline-offset-4">
          Veja como o cálculo funciona
        </Link>
        .
      </p>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-5xl font-bold tabular-nums">{value}</dd>
      <dd className="mt-1 text-[0.95rem] text-ink-soft">{label}</dd>
    </div>
  );
}

function Losses({ data }: { data: StoreInsights }) {
  return (
    <section aria-labelledby="perde">
      <h2 id="perde" className="font-display text-3xl font-bold">
        Onde você perde para quem está perto
      </h2>
      {data.losses.length === 0 ? (
        <p className="mt-3 text-ink-soft">
          Nenhum concorrente a até {NEARBY_M / 1000} km cobra menos nos itens que você vende.
        </p>
      ) : (
        <table className="mt-4 w-full text-left">
          <thead className="text-[0.9rem] text-ink-soft">
            <tr className="border-b border-ink">
              <th scope="col" className="py-2 pr-3 font-medium">
                Produto
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Seu preço
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Melhor por perto
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.losses.map((l) => (
              <tr key={l.label}>
                <th scope="row" className="py-2.5 pr-3 font-normal">
                  {l.label}
                  <span className="block text-[0.85rem] text-ink-soft">{l.bestStore}</span>
                </th>
                <td className="py-2.5 pr-3 text-right tabular-nums">{brl(l.mine)}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {brl(l.best)}
                  <span className="block text-[0.85rem] font-semibold">−{brl(l.mine - l.best)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Demand({ data }: { data: StoreInsights }) {
  const max = Math.max(...data.demand.map((d) => d.lists), 1);
  return (
    <section aria-labelledby="demanda">
      <h2 id="demanda" className="font-display text-3xl font-bold">
        O que as listas pedem
      </h2>
      <p className="mt-1 text-[0.95rem] text-ink-soft">Listas perto da sua loja com pelo menos um item da categoria.</p>
      <ul className="mt-4 space-y-2.5">
        {data.demand.map((d) => (
          <li
            key={d.category}
            className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3"
            title={`${d.label}: ${d.lists} listas`}
          >
            <span className="text-[0.95rem]">{d.label}</span>
            <span className="h-3 rounded-r bg-line" aria-hidden="true">
              <span className="block h-3 rounded-r bg-save" style={{ width: `${(d.lists / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{d.lists}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const SEQ_STEPS = 5;

function Heatmap({ data }: { data: StoreInsights }) {
  const visible = data.cells.filter((c) => c.lists >= K_ANONYMITY).map((c) => c.lists);
  const max = Math.max(...visible, K_ANONYMITY);
  const center = Math.floor(HEATMAP.grid / 2);
  const step = (n: number) =>
    Math.min(SEQ_STEPS, 1 + Math.floor(((n - K_ANONYMITY) / Math.max(max - K_ANONYMITY, 1)) * SEQ_STEPS));

  return (
    <section aria-labelledby="mapa" className="mt-14">
      <h2 id="mapa" className="font-display text-3xl font-bold">
        De onde vêm as listas
      </h2>
      <p className="mt-1 max-w-160 text-[0.95rem] text-ink-soft">
        Cada quadrado tem {HEATMAP.cellM} m de lado, com a sua loja no centro. Quadrados com menos de {K_ANONYMITY}{" "}
        pessoas ficam ocultos para proteger a privacidade.
      </p>
      <div className="mt-5 flex flex-wrap items-start gap-8">
        <div
          role="table"
          aria-label="Listas por quadrado ao redor da loja"
          className="grid w-full max-w-88 gap-0.5"
          style={{ gridTemplateColumns: `repeat(${HEATMAP.grid}, minmax(0, 1fr))` }}
        >
          {data.cells.map((c) => {
            const hidden = c.lists < K_ANONYMITY;
            const isStore = c.row === center && c.col === center;
            const text = hidden ? `menos de ${K_ANONYMITY} pessoas, oculto` : `${c.lists} listas`;
            return (
              <div
                key={`${c.row}-${c.col}`}
                role="cell"
                title={text}
                aria-label={`${isStore ? "Sua loja, " : ""}${text}`}
                className={`relative grid aspect-square place-items-center rounded-sm text-[0.8rem] tabular-nums ${hidden ? "heat-hidden text-muted" : ""}`}
                style={
                  hidden
                    ? undefined
                    : {
                        background: `var(--seq-${step(c.lists)})`,
                        color: step(c.lists) >= 4 ? "var(--paper)" : "var(--ink)",
                      }
                }
              >
                {hidden ? "" : c.lists}
                {isStore && <span aria-hidden="true" className="absolute inset-1 rounded-sm border-2 border-ink" />}
              </div>
            );
          })}
        </div>
        <div className="text-[0.9rem]">
          <p className="font-medium">Listas por quadrado</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="tabular-nums">{K_ANONYMITY}</span>
            <span className="flex gap-0.5" aria-hidden="true">
              {Array.from({ length: SEQ_STEPS }, (_, i) => (
                <span key={i} className="h-3 w-6 rounded-sm" style={{ background: `var(--seq-${i + 1})` }} />
              ))}
            </span>
            <span className="tabular-nums">{max}</span>
          </div>
          <p className="mt-3 flex items-center gap-2">
            <span className="heat-hidden inline-block h-3 w-6 rounded-sm" aria-hidden="true" />
            Oculto (menos de {K_ANONYMITY} pessoas)
          </p>
          <p className="mt-2 flex items-center gap-2">
            <span className="inline-block h-3 w-6 rounded-sm border-2 border-ink" aria-hidden="true" />
            Sua loja
          </p>
        </div>
      </div>
    </section>
  );
}
