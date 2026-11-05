import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { SignOutLink } from "@/components/auth/SessionNav";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/** Moderation area. proxy.ts only lets admins in; the API checks the role again. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-(--header-h) max-w-5xl items-center gap-2 px-4">
          <Logo href="/admin" suffix="admin" />
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/"
              className="inline-flex min-h-tap items-center rounded-full px-3 text-[0.95rem] font-medium text-ink-soft hover:text-ink"
            >
              <span className="hidden sm:inline">Ir para a lista de compras</span>
              <span className="sm:hidden">Lista</span>
            </Link>
            <SignOutLink />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="content" className="flex flex-1 flex-col pb-16">
        <AdminShell>{children}</AdminShell>
      </main>
    </>
  );
}
