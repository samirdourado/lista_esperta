import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/** Sign-in and sign-up: a quiet single column, with a way back to the list. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-(--header-h) max-w-5xl items-center gap-2 px-4">
          <Logo />
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/"
              className="inline-flex min-h-tap items-center rounded-full px-3 text-[0.95rem] font-medium text-ink-soft hover:text-ink"
            >
              Usar sem conta
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="content" className="mx-auto w-full max-w-md flex-1 px-4 pt-8 pb-16 sm:pt-12">
        {children}
      </main>
    </>
  );
}
