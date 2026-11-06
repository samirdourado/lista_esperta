import { CartPlusIcon, CheckIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { brl } from "@/lib/format";
import type { WebOffer } from "@/lib/web-prices/queries";

/** Accessible name of one result: what it is, how much, and what tapping does. */
export const offerLabel = (offer: WebOffer, added = false) =>
  `${offer.title}, ${brl(offer.price)}. ${added ? "Já está na lista" : "Adicionar à lista"}`;

/**
 * The Google Shopping results under the list input: a listbox driven by the
 * input (combobox pattern), cheapest first: photo, name and price only.
 * Tapping a row adds it.
 */
export function WebOffers({
  id,
  offers,
  active,
  added,
  onChoose,
}: {
  id: string;
  offers: WebOffer[];
  active: number;
  /** Indexes already added: a check replaces the cart. */
  added: Set<number>;
  onChoose: (index: number) => void;
}) {
  return (
    <ul id={id} role="listbox" aria-label="Mais baratos na internet" className="divide-y divide-line">
      {offers.map((offer, index) => (
        <li
          key={`${offer.store}-${offer.title}-${index}`}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === active}
          aria-label={offerLabel(offer, added.has(index))}
          onMouseDown={(event) => {
            event.preventDefault();
            onChoose(index);
          }}
          className={cx(
            "flex cursor-pointer items-center gap-3 px-3 py-2.5",
            added.has(index) ? "cursor-default" : "",
            index === active ? "bg-brand-soft" : "hover:bg-surface-sunken",
          )}
        >
          {offer.thumbnail ? (
            // Google's thumbnails: tiny, many hosts, shown as they come.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offer.thumbnail}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-12 shrink-0 rounded-sm bg-white object-contain"
            />
          ) : (
            <span aria-hidden="true" className="size-12 shrink-0 rounded-sm bg-surface-sunken" />
          )}
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 leading-snug font-medium">{offer.title}</span>
          </span>
          <span className="shrink-0 text-right text-lg font-bold tabular-nums">{brl(offer.price)}</span>
          <span
            aria-hidden="true"
            className={cx(
              "grid size-tap shrink-0 place-items-center rounded-full transition-colors",
              added.has(index) ? "bg-success text-surface" : "bg-brand text-on-brand",
            )}
          >
            {added.has(index) ? <CheckIcon strokeWidth={3} /> : <CartPlusIcon />}
          </span>
        </li>
      ))}
    </ul>
  );
}
