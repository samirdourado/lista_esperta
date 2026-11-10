"use client";

import Link from "next/link";
import { useId } from "react";
import { addressLine } from "@/components/stores/StoreSummary";
import { cx } from "@/lib/cx";
import { brl } from "@/lib/format";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import { evidenceLabel, type RankedStore, type Verdict } from "@/lib/verdict/queries";

const km = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

function distanceText(store: RankedStore): string {
  return store.travelKm < 0.2 ? "a menos de 100 m" : km(store.travelKm / 2);
}

/** One item of the list at this store: found with photo and price, or clearly not found. */
function ItemRow({
  store,
  index,
  item,
  verdict,
}: {
  store: RankedStore;
  index: number;
  item?: ShoppingListItem;
  verdict: Verdict;
}) {
  const line = store.lines[index];
  const resolved = verdict.items[index];
  const quantity = item?.quantity && item.quantity > 1 ? `${item.quantity}× ` : "";
  const name = line?.productName ?? resolved?.productName ?? resolved?.text ?? item?.freeText ?? "";
  const found = line?.subtotal !== null && line?.subtotal !== undefined;

  return (
    <li className="flex items-center gap-3 py-2.5">
      {line?.imageUrl ? (
        // Product photos come from the price source, on several hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={line.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-12 shrink-0 rounded-sm bg-white object-contain"
        />
      ) : (
        <span aria-hidden="true" className="size-12 shrink-0 rounded-sm bg-surface-sunken" />
      )}
      <span className="min-w-0 flex-1">
        <span className={cx("line-clamp-2 leading-snug", !found && "text-ink-soft")}>
          {quantity}
          {found ? name : (resolved?.text ?? name)}
        </span>
        {found && line.evidence ? (
          <span className="block text-[0.8rem] text-ink-soft">{evidenceLabel(line.evidence)}</span>
        ) : (
          <span className="block text-[0.8rem] font-medium text-danger">Não encontrado neste supermercado</span>
        )}
      </span>
      {found && <span className="shrink-0 font-semibold tabular-nums">{brl(line.subtotal!)}</span>}
    </li>
  );
}

/**
 * The stores as an accordion, cheapest list first (D-078). The header carries
 * the store and the price; opening it shows the person's list at that store.
 */
export function StoreAccordion({
  ranking,
  items,
  verdict,
  expandedId,
  onToggle,
}: {
  ranking: RankedStore[];
  items: ShoppingListItem[];
  verdict: Verdict;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  const baseId = useId();
  return (
    <ol aria-label="Lojas com produtos da sua lista" className="flex flex-col gap-2">
      {ranking.map((entry, position) => {
        const expanded = expandedId === entry.store.id;
        const panelId = `${baseId}-${position}`;
        const address = addressLine(entry.store.address);
        return (
          <li
            key={entry.store.id}
            data-store={entry.store.id}
            className={cx(
              "overflow-hidden rounded-md border bg-surface",
              expanded ? "border-brand ring-2 ring-brand/30" : "border-line",
            )}
          >
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => onToggle(entry.store.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left font-sans text-base leading-normal font-normal tracking-normal normal-case hover:bg-surface-sunken/60"
              >
                <span className="mt-0.5 shrink-0 text-ink-soft tabular-nums">{position + 1}º</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.05rem] leading-snug font-semibold">{entry.store.name}</span>
                  {address && <span className="block text-[0.9rem] text-ink-soft">{address}</span>}
                  <span className="block text-[0.85rem] text-ink-soft">
                    {distanceText(entry)} · {entry.found} de {items.length} {items.length === 1 ? "item" : "itens"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xl font-bold tabular-nums">{brl(entry.itemsCost)}</span>
                  <span
                    aria-hidden="true"
                    className={cx("inline-block text-ink-soft transition-transform", expanded && "rotate-180")}
                  >
                    ▾
                  </span>
                </span>
              </button>
            </h3>
            <div id={panelId} hidden={!expanded} className="border-t border-line px-4">
              <ul className="divide-y divide-line">
                {items.map((item, index) => (
                  <ItemRow key={index} store={entry} index={index} item={item} verdict={verdict} />
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Two stores, only when it saves more than the thresholds (spec section 7). */
export function SplitCard({ verdict, items }: { verdict: Verdict; items: ShoppingListItem[] }) {
  const split = verdict.split;
  if (!split) return null;
  return (
    <section aria-labelledby="split" className="rounded-md border-2 border-brand bg-brand-soft/40 p-4">
      <h2 id="split" className="text-xl font-bold">
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

/** Required by the source: visible credit whenever its prices are on screen. */
export function PriceSourceCredit({ ranking }: { ranking: RankedStore[] }) {
  const used = ranking.some((entry) => entry.lines.some((line) => line.evidence?.source === "PRECOMELHOR"));
  if (!used) return null;
  return (
    <p className="text-[0.85rem] text-ink-soft">
      Preços de supermercados por{" "}
      <Link
        href="https://www.precomelhor.com.br"
        target="_blank"
        rel="noopener"
        className="font-medium underline underline-offset-4"
      >
        PreçoMelhor
      </Link>
      .
    </p>
  );
}
