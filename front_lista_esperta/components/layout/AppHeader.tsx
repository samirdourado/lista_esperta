import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { StoreIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { HeaderNav } from "./ShopperNav";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-(--header-h) max-w-5xl items-center gap-2 px-4">
        <Logo />
        <div className="ml-auto flex items-center gap-1">
          <HeaderNav />
          <Link
            href="/merchant"
            className="inline-flex min-h-tap items-center gap-1.5 rounded-full px-3 text-[0.95rem] font-medium text-ink-soft hover:text-ink md:ml-2 md:border md:border-line"
          >
            <StoreIcon />
            Tenho uma loja
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
