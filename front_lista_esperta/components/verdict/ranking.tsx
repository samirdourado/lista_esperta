import Link from "next/link";
import { PriceTag } from "@/components/PriceTag";
import { VerificationNote, addressLine } from "@/components/stores/StoreSummary";
import { brl } from "@/lib/format";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import { evidenceLabel, type RankedStore, type Verdict } from "@/lib/verdict/queries";

const km = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
const minutes = (value: number) =>
  value < 60 ? `${Math.round(value)} min` : `${Math.floor(value / 60)} h ${Math.round(value % 60)} min`;

/** The answer: the store nearby where the whole list costs least (D-069). */
export function BestStore({ best }: { best: RankedStore }) {
  return (
    <section aria-labelledby="best-store">
      <p className="text-ink-soft">Compre tudo em</p>
      <h2 id="best-store" className="mt-1 font-display text-[clamp(2.2rem,9vw,3.2rem)] leading-none font-bold">
        {best.store.name}
      </h2>
      <p className="mt-1 text-[0.95rem] text-ink-soft">{addressLine(best.store.address) ?? ""}</p>
      <div className="mt-5 text-[clamp(3.4rem,16vw,4.8rem)] leading-none">
        <PriceTag value={best.totalCost} land />
      </div>
      <p className="mt-3 text-ink-soft">
        {best.missing.length > 0
          ? "Total da lista nesta loja, com a média da região para o que ela não tem."
          : "Total da sua lista nesta loja."}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-4 sm:grid-cols-3">
        <div>
          <dt className="text-[0.9rem] text-ink-soft">Itens</dt>
          <dd className="text-xl font-bold">
            {best.found} de {best.priced}
          </dd>
        </div>
        <div>
          <dt className="text-[0.9rem] text-ink-soft">Produtos</dt>
          <dd className="text-xl font-bold">{brl(best.itemsCost)}</dd>
        </div>
        <div>
          <dt className="text-[0.9rem] text-ink-soft">Ida e volta</dt>
          <dd className="text-xl font-bold">
            {km(best.travelKm)} · {minutes(best.travelMinutes)}
          </dd>
        </div>
      </dl>
      <div className="mt-2 flex flex-wrap gap-x-3">
        <VerificationNote status={best.store.verificationStatus} />
        {best.store.openNow === null && <span className="text-[0.85rem] text-muted">Horário não informado</span>}
      </div>
    </section>
  );
}

/** What each item costs at a store and where the price comes from. */
export function ItemLines({
  store,
  items,
  verdict,
}: {
  store: RankedStore;
  items: ShoppingListItem[];
  verdict: Verdict;
}) {
  return (
    <ul className="divide-y divide-line">
      {store.lines.map((line) => {
        const item = items[line.index];
        const resolved = verdict.items[line.index];
        if (!resolved?.priced) return null;
        return (
          <li key={line.index} className="flex items-start justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block">
                {item?.quantity && item.quantity > 1 ? `${item.quantity}× ` : ""}
                {resolved.productName ?? resolved.text}
              </span>
              <span className="text-[0.85rem] text-ink-soft">
                {line.evidence
                  ? evidenceLabel(line.evidence)
                  : `Sem preço aqui: conta a mediana da região (${brl(resolved.regionalMedian ?? 0)})`}
              </span>
              {item?.webPrice && (
                <span className="block text-[0.85rem] text-ink-soft">
                  Na internet: {brl(item.webPrice.price)} em {item.webPrice.store}
                </span>
              )}
              {resolved.productId && (
                <Link
                  href={`/alerts?product=${resolved.productId}&name=${encodeURIComponent(resolved.productName ?? resolved.text)}`}
                  className="block text-[0.85rem] font-medium text-brand underline-offset-4 hover:underline"
                >
                  Avisar quando baixar
                </Link>
              )}
            </span>
            <span className={line.subtotal === null ? "shrink-0 text-muted tabular-nums" : "shrink-0 tabular-nums"}>
              {line.subtotal === null ? "—" : brl(line.subtotal)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Two stores, only when it saves more than the thresholds (spec section 7). */
export function SplitCard({ verdict, items }: { verdict: Verdict; items: ShoppingListItem[] }) {
  const split = verdict.split;
  if (!split) return null;
  return (
    <section aria-labelledby="split" className="rounded-md border-2 border-brand bg-brand-soft/40 p-4">
      <h2 id="split" className="text-2xl font-bold">
        Dividindo em duas lojas você economiza {brl(split.savings)}
      </h2>
      <p className="mt-1 text-ink-soft">
        Total de {brl(split.totalCost)}, com {km(split.travelKm)} de trajeto passando pelas duas.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {split.stores.map((store) => {
          const mine = Object.entries(split.assignment)
            .filter(([, storeId]) => storeId === store.id)
            .map(([index]) => verdict.items[Number(index)]);
          return (
            <div key={store.id}>
              <p className="font-semibold">{store.name}</p>
              <ul className="mt-1 list-disc pl-5 text-[0.95rem] text-ink-soft">
                {mine.map((item) => (
                  <li key={item.index}>
                    {items[item.index]?.quantity > 1 ? `${items[item.index].quantity}× ` : ""}
                    {item.productName ?? item.text}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The rest of the ranking, cheapest list first. */
export function OtherStores({ ranking }: { ranking: RankedStore[] }) {
  if (ranking.length === 0) return null;
  return (
    <section aria-labelledby="others">
      <h2 id="others" className="text-2xl font-bold">
        Outras lojas por perto
      </h2>
      <ol className="mt-2 divide-y divide-line rounded-md border border-line bg-surface">
        {ranking.map((entry, position) => (
          <li key={entry.store.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
            <span>
              <span className="mr-2 text-ink-soft tabular-nums">{position + 2}º</span>
              <span className="font-medium">{entry.store.name}</span>
              <span className="block text-[0.85rem] text-ink-soft">
                {entry.found} de {entry.priced} itens · {km(entry.travelKm)} ida e volta
              </span>
            </span>
            <span className="font-semibold tabular-nums">{brl(entry.totalCost)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
