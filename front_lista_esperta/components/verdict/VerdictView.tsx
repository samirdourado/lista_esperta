import Link from "next/link";
import { PriceTag } from "@/components/PriceTag";
import { SourceBadge } from "@/components/SourceBadge";
import type { Sponsored } from "@/lib/ads/select";
import { FORMAT_LABEL, PILOT_NAME } from "@/lib/demo/stores";
import type { Tip } from "@/lib/forecast/heuristic";
import { brl, km, meters, minutes, qtyLabel } from "@/lib/format";
import { editHref, RADIUS_OPTIONS_M, verdictHref, type VerdictQuery } from "@/lib/list/query";
import type { ItemView, PlanView, StoreView, Verdict } from "@/lib/verdict/build";
import { COST_PER_KM, MODE_LABEL, STOP_OVERHEAD_MIN, VALUE_PER_MIN } from "@/lib/verdict/params";

interface Props {
  verdict: Verdict;
  query: VerdictQuery;
  sponsored: Sponsored[];
  tip: Tip | null;
}

const MODE_PHRASE = { DRIVE: "de carro", WALK: "a pé", BICYCLE: "de bicicleta", TRANSIT: "de ônibus ou metrô" };

export function VerdictView({ verdict, query, sponsored, tip }: Props) {
  const plan = verdict.primary;
  const itemsWord = verdict.itemCount === 1 ? "item" : "itens";

  return (
    <article>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[0.95rem] text-ink-soft">
        <p>
          {verdict.itemCount} {itemsWord}, até {query.radiusM / 1000} km, {MODE_PHRASE[query.mode]}.
        </p>
        <Link href={editHref(query)} className="font-medium text-ink underline underline-offset-4">
          Editar lista
        </Link>
      </div>
      {query.pilot && (
        <p className="mt-3 rounded-lg bg-muted-soft px-3 py-2 text-[0.95rem]">
          Partindo do centro da {PILOT_NAME}: por enquanto é o único bairro com preços. Sua localização não foi usada.
        </p>
      )}

      {plan ? <Decision verdict={verdict} plan={plan} query={query} tip={tip} /> : <NoStores verdict={verdict} query={query} />}

      {verdict.unmatched.length > 0 && (
        <p className="mt-8 text-[0.95rem] text-ink-soft">
          Ficaram fora da conta porque ainda não estão no catálogo: {verdict.unmatched.join(", ")}.
        </p>
      )}

      {plan && <SponsoredSlot verdict={verdict} query={query} sponsored={sponsored} />}
    </article>
  );
}

function Decision({ verdict, plan, query, tip }: { verdict: Verdict; plan: PlanView; query: VerdictQuery; tip: Tip | null }) {
  const low = verdict.confidence.level === "baixa";
  const intro = low ? "Provavelmente mais barato em" : plan.type === "split" ? "Divida a compra entre" : "Compre tudo em";
  const alt = verdict.alternative;

  return (
    <>
      <header className="mt-8">
        <p className="text-lg text-ink-soft">{intro}</p>
        <h1 className="mt-1 font-display text-[clamp(2.2rem,9vw,3.2rem)] font-bold leading-none tracking-tight text-balance">
          {plan.stores.map((s, i) => (
            <span key={s.id} className="block">
              {i > 0 && <span className="font-semibold text-ink-soft">e </span>}
              {s.name}
            </span>
          ))}
        </h1>
      </header>

      <div className="mt-7 text-[clamp(4.5rem,22vw,7rem)]">
        <PriceTag value={plan.total} land />
      </div>
      <p className="mt-3 text-ink-soft">Custo total, já contando deslocamento e o seu tempo.</p>

      {plan.type === "split" && alt && verdict.splitSaving !== null && (
        <p className="mt-3 text-lg font-semibold text-save">
          {brl(verdict.splitSaving)} a menos do que comprar tudo no {alt.stores[0].name}.
        </p>
      )}
      {plan.type === "single" && alt && verdict.splitSaving !== null && verdict.splitSaving > 0 && (
        <p className="mt-3 text-lg">
          Dividir com {alt.stores.find((s) => s.id !== plan.stores[0].id)?.name} economizaria só {brl(verdict.splitSaving)}.
          Não compensa a parada extra.
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-4">
        <div>
          <dt className="text-[0.9rem] text-ink-soft">Trajeto ida e volta</dt>
          <dd className="font-display text-2xl font-semibold">
            {km(plan.travel.km)}, {minutes(plan.travel.minutes)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.9rem] text-ink-soft">Confiança nos preços</dt>
          <dd className="font-display text-2xl font-semibold capitalize">{verdict.confidence.level}</dd>
        </div>
        <p className="col-span-2 text-[0.95rem] text-ink-soft">
          {verdict.confidence.confirmed} de {verdict.confidence.priced} itens com preço confirmado por nota fiscal ou por
          várias pessoas nas últimas horas.{" "}
          <Link href="/transparencia" className="underline underline-offset-4">
            Como calculamos
          </Link>
        </p>
      </dl>

      <a
        href={plan.routeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 block rounded-full bg-ink px-6 py-4 text-center font-display text-2xl font-semibold text-paper hover:opacity-90"
      >
        Abrir rota no Google Maps
      </a>

      {low && (
        <p className="mt-4 rounded-lg border border-dashed border-ink-soft px-4 py-3 text-[0.95rem]">
          Ainda temos poucos preços confirmados aqui.{" "}
          <Link href="/nota" className="font-semibold underline underline-offset-4">
            Envie sua nota fiscal depois da compra
          </Link>{" "}
          e o próximo veredito fica mais preciso para todo mundo do bairro.
        </p>
      )}

      {tip && <TipNote tip={tip} query={query} />}

      <section aria-labelledby="por-loja" className="mt-12">
        <h2 id="por-loja" className="font-display text-3xl font-bold">
          O que comprar em cada lugar
        </h2>
        {plan.stores.map((s) => (
          <StoreBlock key={s.id} store={s} />
        ))}
        {plan.estimated.length > 0 && <EstimatedBlock items={plan.estimated} />}
      </section>

      <Breakdown plan={plan} alternative={alt} query={query} />
    </>
  );
}

function TipNote({ tip, query }: { tip: Tip; query: VerdictQuery }) {
  const waiting = new Set(tip.lines);
  const remaining = query.lines.filter((_, i) => !waiting.has(i));
  return (
    <aside className="mt-6 border-l-4 border-tag bg-surface px-4 py-3">
      <p className="font-semibold">
        {tip.message}. Esperar deve economizar cerca de {brl(tip.saving)}.
      </p>
      <p className="mt-1 text-[0.9rem] text-ink-soft">
        Previsão a partir de {tip.source.toLowerCase()}, confiança de {Math.round(tip.confidence * 100)} %.
      </p>
      {remaining.length > 0 && (
        <Link href={verdictHref({ ...query, lines: remaining })} className="mt-2 inline-block font-medium underline underline-offset-4">
          Deixar para {tip.day} e recalcular
        </Link>
      )}
    </aside>
  );
}

function ItemRow({ item }: { item: ItemView }) {
  const qty = qtyLabel(item.qty, item.unit);
  return (
    <li className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p>
          {qty && <span className="mr-1 font-semibold">{qty}</span>}
          {item.label}
          {item.equivalent && <span className="text-ink-soft"> (outra marca, mais barata)</span>}
        </p>
        <div className="mt-1">
          <SourceBadge badge={item.badge} />
        </div>
      </div>
      <p className="shrink-0 font-display text-xl font-semibold tabular-nums">{brl(item.cost)}</p>
    </li>
  );
}

function StoreBlock({ store }: { store: StoreView }) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-1">
        <h3 className="font-display text-2xl font-bold">{store.name}</h3>
        <p className="shrink-0 font-display text-xl font-semibold tabular-nums">{brl(store.subtotal)}</p>
      </div>
      <p className="mt-1 text-[0.9rem] text-ink-soft">
        {FORMAT_LABEL[store.format]}, {store.address}, a {meters(store.distanceM)} em linha reta.
      </p>
      <ul className="divide-y divide-line">
        {store.items.map((i) => (
          <ItemRow key={i.line} item={i} />
        ))}
      </ul>
    </div>
  );
}

function EstimatedBlock({ items }: { items: ItemView[] }) {
  return (
    <div className="mt-8">
      <h3 className="font-display text-2xl font-bold">Sem preço nesses lugares</h3>
      <p className="mt-1 text-[0.95rem] text-ink-soft">
        Para não esconder o custo, usamos o preço da região com 15 % a mais. Confira na loja.
      </p>
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <ItemRow key={i.line} item={i} />
        ))}
      </ul>
    </div>
  );
}

function Breakdown({ plan, alternative, query }: { plan: PlanView; alternative: PlanView | null; query: VerdictQuery }) {
  const stops = plan.stores.length;
  return (
    <section aria-labelledby="conta" className="mt-12">
      <h2 id="conta" className="font-display text-3xl font-bold">
        Como chegamos nesse total
      </h2>
      <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.95rem]" aria-label="Ordem do trajeto">
        {["Você", ...plan.stores.map((s) => s.name), "Você"].map((name, i, all) => (
          <li key={`${name}-${i}`} className="flex items-center gap-2">
            <span className={i === 0 || i === all.length - 1 ? "text-ink-soft" : "font-semibold"}>{name}</span>
            {i < all.length - 1 && <span aria-hidden="true" className="h-0.5 w-5 bg-ink-soft" />}
          </li>
        ))}
      </ol>
      <table className="mt-4 w-full text-left">
        <tbody className="divide-y divide-line">
          <Row label="Produtos" value={plan.basket} />
          <Row
            label={
              query.mode === "DRIVE"
                ? `Deslocamento: ${km(plan.travel.km)} a ${brl(COST_PER_KM.DRIVE)} por km`
                : query.mode === "TRANSIT"
                  ? "Deslocamento: duas passagens"
                  : `Deslocamento ${MODE_LABEL[query.mode].toLowerCase()}: sem custo`
            }
            value={plan.travel.cost}
          />
          <Row
            label={`Seu tempo: ${minutes(plan.travel.minutes)} de trajeto e ${stops} ${stops === 1 ? "parada" : "paradas"} de ${STOP_OVERHEAD_MIN} min, a ${brl(VALUE_PER_MIN)} por minuto`}
            value={plan.timeCost}
          />
          <tr className="font-semibold">
            <th scope="row" className="py-2 pr-4 font-display text-xl">
              Total
            </th>
            <td className="whitespace-nowrap py-2 text-right font-display text-xl tabular-nums">{brl(plan.total)}</td>
          </tr>
        </tbody>
      </table>
      {alternative && (
        <p className="mt-4 text-[0.95rem] text-ink-soft">
          Para comparar: {alternative.stores.map((s) => s.name).join(" e ")} sairia {brl(alternative.total)} no total (
          {brl(alternative.basket)} em produtos).
        </p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <th scope="row" className="py-2 pr-4 font-normal">
        {label}
      </th>
      <td className="whitespace-nowrap py-2 align-top text-right tabular-nums">{brl(value)}</td>
    </tr>
  );
}

function NoStores({ verdict, query }: { verdict: Verdict; query: VerdictQuery }) {
  const bigger = RADIUS_OPTIONS_M.filter((r) => r > query.radiusM);
  const noItems = verdict.storesInRadius > 0;
  return (
    <div className="mt-8">
      <h1 className="font-display text-4xl font-bold leading-tight">
        {noItems ? "Nenhum item reconhecido" : `Nenhum mercado com preço até ${query.radiusM / 1000} km`}
      </h1>
      <p className="mt-2 text-ink-soft">
        {noItems
          ? "Revise a lista: escreva um item por linha, como “arroz 5kg” ou “2 leite integral”."
          : "Aumente o raio ou envie uma nota fiscal de um mercado da região para colocá-lo no mapa."}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {!noItems &&
          bigger.map((r) => (
            <Link key={r} href={verdictHref({ ...query, radiusM: r })} className="rounded-full border border-ink px-4 py-2 font-medium">
              Tentar com {r / 1000} km
            </Link>
          ))}
        <Link href={editHref(query)} className="rounded-full bg-ink px-4 py-2 font-medium text-paper">
          Editar lista
        </Link>
      </div>
    </div>
  );
}

function SponsoredSlot({ verdict, query, sponsored }: { verdict: Verdict; query: VerdictQuery; sponsored: Sponsored[] }) {
  return (
    <section aria-labelledby="patrocinado" className="mt-14 border-t border-dashed border-ink-soft pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="patrocinado" className="font-display text-xl font-semibold text-ink-soft">
          Patrocinado
        </h2>
        <Link href={verdictHref({ ...query, ads: !query.ads })} className="text-[0.95rem] font-medium underline underline-offset-4">
          {query.ads ? "Ver sem anúncios" : "Mostrar anúncios"}
        </Link>
      </div>
      {query.ads ? (
        sponsored.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {sponsored.map((s) => (
              <li key={s.campaignId} className="rounded-lg border border-line bg-surface px-4 py-3">
                <p className="font-medium">{s.offer}</p>
                <p className="text-[0.9rem] text-ink-soft">
                  {s.storeName}, a {meters(s.distanceM)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.95rem] text-ink-soft">Nenhuma oferta patrocinada para esta lista.</p>
        )
      ) : (
        <p className="mt-2 text-[0.95rem] text-ink-soft">Anúncios desligados. O veredito acima continua igual.</p>
      )}
      <p className="mt-4 text-[0.9rem] text-ink-soft">
        Anúncios aparecem só aqui e não entram no cálculo. O código de verificação abaixo é o mesmo com ou sem anúncios:
      </p>
      <p className="mt-1 break-all text-[0.85rem]">
        <code>{verdict.rankingHash}</code>
      </p>
      <p className="mt-1 text-[0.85rem] text-muted">Algoritmo {verdict.algoVersion}</p>
    </section>
  );
}
