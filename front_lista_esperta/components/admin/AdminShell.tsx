"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAdminOverview } from "@/lib/admin/queries";
import { cx } from "@/lib/cx";

const TABS = [
  { href: "/admin", label: "Visão geral", count: null },
  { href: "/admin/claims", label: "Reivindicações", count: "pendingClaims" },
  { href: "/admin/stores", label: "Verificações", count: "pendingVerifications" },
  { href: "/admin/catalog", label: "Catálogo", count: "pendingAliases" },
] as const;

/** Title and section tabs of the moderation area, with what is waiting in each. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const overview = useAdminOverview();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6">
      <h1 className="font-display text-[clamp(2rem,7vw,3rem)] leading-none font-bold tracking-tight">Moderação</h1>
      <nav aria-label="Seções da moderação" className="-mx-4 mt-5 overflow-x-auto border-b border-line px-4">
        <ul className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const current = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
            const count = tab.count && overview.data ? overview.data[tab.count] : 0;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-tap items-center gap-1.5 border-b-2 px-3 font-medium whitespace-nowrap",
                    current ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink",
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className="rounded-full bg-brand-soft px-1.5 text-[0.8rem] text-brand tabular-nums">
                      {count}
                      <span className="sr-only"> pendentes</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="py-6">{children}</div>
    </div>
  );
}
