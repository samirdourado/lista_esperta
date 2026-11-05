import type { Verdict } from "@/lib/verdict/queries";

/**
 * Paid content lives here, below the answer, clearly labelled. It is never
 * mixed into the ranking (spec section 7; enforced by ESLint and API tests).
 */
export function SponsoredBlock({ items }: { items: Verdict["sponsored"] }) {
  if (items.length === 0) return null;
  return (
    <aside aria-labelledby="sponsored" className="rounded-md border border-dashed border-line-strong p-4">
      <h2 id="sponsored" className="text-[0.85rem] font-semibold text-muted">
        Patrocinado
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li key={`${item.storeId}-${item.title}`}>
            <span className="font-medium">{item.title}</span> <span className="text-ink-soft">· {item.storeName}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.85rem] text-muted">Anúncios não mudam a ordem das lojas acima.</p>
    </aside>
  );
}
