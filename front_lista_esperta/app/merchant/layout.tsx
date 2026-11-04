import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/** Merchant dashboard shell. Login protection arrives in phase 3 (proxy.ts). */
export default function MerchantLayout({ children }: LayoutProps<"/merchant">) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-(--header-h) max-w-5xl items-center gap-2 px-4">
          <Logo href="/merchant" suffix="para lojas" />
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/"
              className="inline-flex min-h-tap items-center rounded-full px-3 text-[0.95rem] font-medium text-ink-soft hover:text-ink"
            >
              Ir para a lista de compras
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="content" className="flex flex-1 flex-col pb-16">
        {children}
      </main>
    </>
  );
}
