import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-xl font-bold tracking-tight sm:text-2xl">
          <TagMark />
          Lista Esperta
        </Link>
        <nav aria-label="Principal" className="flex gap-3 whitespace-nowrap text-[0.9rem] font-medium text-ink-soft sm:gap-4 sm:text-[0.95rem]">
          <Link href="/nota" className="hover:text-ink">
            Enviar nota
          </Link>
          <Link href="/lojista" className="hidden hover:text-ink sm:inline">
            Para lojistas
          </Link>
          <Link href="/transparencia" className="hover:text-ink">
            Como calculamos
          </Link>
        </nav>
      </div>
    </header>
  );
}

function TagMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="-rotate-12">
      <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h7.2l8.3 8.3a2 2 0 0 1 0 2.8l-6.9 6.9a2 2 0 0 1-2.8 0L3 12.7z" fill="var(--tag)" />
      <circle cx="7.5" cy="7.5" r="1.7" fill="var(--ink)" />
    </svg>
  );
}
