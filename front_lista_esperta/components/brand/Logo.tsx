import Image from "next/image";
import Link from "next/link";

/** Logo + wordmark, linking home. The image is decorative; the wordmark carries the name. */
export function Logo({ href = "/", suffix }: { href?: string; suffix?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-tap shrink-0 items-center gap-2 font-display text-xl font-bold tracking-tight whitespace-nowrap text-brand sm:text-2xl"
    >
      <Image src="/logo_lista_esperta.webp" alt="" width={999} height={903} priority className="h-8 w-auto sm:h-9" />
      <span>
        Lista Esperta
        {suffix && <span className="hidden font-semibold text-ink-soft sm:inline"> {suffix}</span>}
      </span>
    </Link>
  );
}
