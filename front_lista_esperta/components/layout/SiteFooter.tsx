import Link from "next/link";
import { PANEL_HREF } from "@/lib/panels";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-[0.9rem] text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>Use sem cadastro. O ranking considera só o preço da lista, nunca anúncios.</p>
        <ul className="flex gap-4">
          <li>
            <Link
              href={PANEL_HREF.howItWorks}
              scroll={false}
              className="inline-flex min-h-tap items-center underline-offset-4 hover:underline"
            >
              Como calculamos
            </Link>
          </li>
          <li>
            <Link href="/merchant" className="inline-flex min-h-tap items-center underline-offset-4 hover:underline">
              Tenho uma loja
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
