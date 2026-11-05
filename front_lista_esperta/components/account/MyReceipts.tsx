"use client";

import Link from "next/link";
import { brl } from "@/lib/format";
import { useMyReceipts } from "@/lib/receipts/queries";

/** Receipt history: one of the reasons to have an account (spec section 3). */
export function MyReceipts() {
  const receipts = useMyReceipts();
  const items = receipts.data ?? [];
  return (
    <section aria-labelledby="my-receipts" className="flex flex-col gap-3">
      <h2 id="my-receipts" className="text-2xl font-bold">
        Suas notas fiscais
      </h2>
      {receipts.isSuccess && items.length === 0 && (
        <p className="text-ink-soft">
          Você ainda não enviou notas.{" "}
          <Link href="/receipts/import" className="font-semibold text-brand underline underline-offset-4">
            Enviar uma nota
          </Link>
        </p>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {items.map((receipt) => (
            <li key={receipt.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <span className="font-medium">{receipt.store.name}</span>
              <span className="text-[0.95rem] text-ink-soft tabular-nums">
                {new Date(receipt.issuedAt).toLocaleDateString("pt-BR")} · {brl(receipt.total)} · {receipt.pricesAdded}{" "}
                {receipt.pricesAdded === 1 ? "preço" : "preços"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
