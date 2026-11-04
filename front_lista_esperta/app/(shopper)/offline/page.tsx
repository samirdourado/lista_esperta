import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/PageHeading";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Sem internet" };

/** Fallback served by the service worker when a page was never cached. */
export default function OfflinePage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-10">
      <PageHeading
        title="Esta página precisa de internet"
        lead="Ela ainda não foi aberta neste aparelho. As páginas que você já visitou continuam disponíveis."
      />
      <Link href="/" className={cx(buttonClasses({ size: "lg" }), "mt-8")}>
        Abrir minha lista
      </Link>
    </div>
  );
}
