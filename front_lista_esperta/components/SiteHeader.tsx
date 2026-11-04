import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-xl font-bold tracking-tight text-brand sm:text-2xl"
        >
          <Image
            src="/logo_lista_esperta.webp"
            alt=""
            width={999}
            height={903}
            priority
            className="h-8 w-auto sm:h-9"
          />
          Lista Esperta
        </Link>
        <nav aria-label="Principal" className="flex gap-3 whitespace-nowrap text-[0.9rem] font-medium text-ink-soft sm:gap-4 sm:text-[0.95rem]">
          <Link href="/nota" className="hover:text-brand">
            Enviar nota
          </Link>
          <Link href="/lojista" className="hidden hover:text-brand sm:inline">
            Para lojistas
          </Link>
          <Link href="/transparencia" className="hover:text-brand">
            Como calculamos
          </Link>
        </nav>
      </div>
    </header>
  );
}
