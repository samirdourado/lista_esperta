"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InfoIcon, ListIcon, MapPinIcon, ReceiptIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { isCurrent, SHOPPER_NAV, TAB_NAV, type NavIcon } from "@/lib/navigation";

const ICON: Record<NavIcon, typeof ListIcon> = {
  list: ListIcon,
  store: MapPinIcon,
  receipt: ReceiptIcon,
  info: InfoIcon,
};

/** Inline links in the header, on wide screens (1024 px+). */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {SHOPPER_NAV.map((item) => {
          const current = isCurrent(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-tap items-center rounded-full px-3.5 font-medium",
                  current ? "bg-brand-soft text-brand" : "text-ink-soft hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom tab bar on phones, where the thumb reaches. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid h-(--tabbar-h) max-w-xl grid-cols-3">
        {TAB_NAV.map((item) => {
          const current = isCurrent(item, pathname);
          const Icon = ICON[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.8rem] font-medium",
                  current ? "text-brand" : "text-ink-soft",
                )}
              >
                {current && <span aria-hidden="true" className="absolute top-0 h-0.5 w-10 rounded-full bg-brand" />}
                <Icon width="1.5rem" height="1.5rem" strokeWidth={current ? 2.4 : 2} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
