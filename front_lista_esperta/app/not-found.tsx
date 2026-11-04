import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/PageHeading";
import { cx } from "@/lib/cx";

export default function NotFound() {
  return (
    <main id="content" className="mx-auto w-full max-w-xl flex-1 px-4 pt-6">
      <Logo />
      <div className="mt-12">
        <PageHeading
          title="Página não encontrada"
          lead="O endereço pode ter mudado. Comece pela sua lista de compras."
        />
        <Link href="/" className={cx(buttonClasses({ size: "lg" }), "mt-8")}>
          Abrir minha lista
        </Link>
      </div>
    </main>
  );
}
