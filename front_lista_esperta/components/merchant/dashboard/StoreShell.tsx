"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { VerificationNote } from "@/components/stores/StoreSummary";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { cx } from "@/lib/cx";
import { useMyStores } from "@/lib/stores/queries";

const TABS = [
  { href: "", label: "Visão geral" },
  { href: "/products", label: "Produtos e preços" },
  { href: "/import", label: "Importar planilha" },
  { href: "/flyers", label: "Encartes" },
  { href: "/team", label: "Equipe" },
  { href: "/settings", label: "Loja" },
];

/** Header and tabs for one store's dashboard. */
export function StoreShell({ children }: { children: ReactNode }) {
  const { storeId } = useParams<{ storeId: string }>();
  const pathname = usePathname();
  const stores = useMyStores();
  const store = stores.data?.find((s) => s.id === storeId);
  const base = `/merchant/stores/${storeId}`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6">
      <Link
        href="/merchant"
        className="inline-flex min-h-tap items-center text-[0.95rem] font-medium text-ink-soft hover:text-ink"
      >
        Todas as suas lojas
      </Link>
      {stores.isPending ? (
        <Skeleton className="mt-2 h-10 w-2/3" />
      ) : store ? (
        <header className="mt-1">
          <h1 className="font-display text-[clamp(2rem,7vw,3rem)] leading-none font-bold tracking-tight">
            {store.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-3">
            <VerificationNote status={store.verificationStatus} />
            <span className="text-[0.85rem] text-ink-soft">
              {store.memberRole === "OWNER" ? "Você é dono(a)" : "Você é da equipe"}
            </span>
          </div>
        </header>
      ) : (
        <Notice tone="danger" title="Você não administra esta loja." className="mt-4" />
      )}

      <nav aria-label="Seções da loja" className="-mx-4 mt-5 overflow-x-auto border-b border-line px-4">
        <ul className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const href = `${base}${tab.href}`;
            const current = tab.href === "" ? pathname === base : pathname.startsWith(href);
            return (
              <li key={tab.href}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-tap items-center border-b-2 px-3 font-medium whitespace-nowrap",
                    current ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="py-6">{store ? children : null}</div>
    </div>
  );
}

/** The store id from the URL, for the dashboard pages. */
export function useStoreId(): string {
  return useParams<{ storeId: string }>().storeId;
}

/** Owner-only actions are hidden from staff (the API refuses them anyway). */
export function useIsOwner(storeId: string): boolean {
  const stores = useMyStores();
  return stores.data?.find((s) => s.id === storeId)?.memberRole === "OWNER";
}
