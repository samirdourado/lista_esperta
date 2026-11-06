"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InfoIcon, ReceiptIcon } from "@/components/icons";
import { HowItWorks } from "@/components/info/HowItWorks";
import { ReceiptImport } from "@/components/receipts/ReceiptImport";
import { Sheet } from "@/components/ui/Sheet";
import { PANEL_HREF, PANEL_PARAM, panelFrom } from "@/lib/panels";

const TITLE = { receipt: "Enviar nota fiscal", howItWorks: "Como calculamos" } as const;

/** The two buttons under the list and the panels they open (D-072). */
export function HomePanels() {
  const router = useRouter();
  const pathname = usePathname();
  const open = panelFrom(useSearchParams().get(PANEL_PARAM));
  const close = () => router.replace(pathname, { scroll: false });

  return (
    <>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link
          href={PANEL_HREF.receipt}
          scroll={false}
          className="flex min-h-tap items-start gap-3 rounded-md border border-line bg-surface p-4 hover:border-line-strong"
        >
          <ReceiptIcon width="1.5rem" height="1.5rem" className="mt-0.5 shrink-0 text-brand" />
          <span>
            <span className="block font-semibold">Enviar nota fiscal</span>
            <span className="block text-[0.9rem] text-ink-soft">
              O QR Code do cupom atualiza os preços para quem compra perto.
            </span>
          </span>
        </Link>
        <Link
          href={PANEL_HREF.howItWorks}
          scroll={false}
          className="flex min-h-tap items-start gap-3 rounded-md border border-line bg-surface p-4 hover:border-line-strong"
        >
          <InfoIcon width="1.5rem" height="1.5rem" className="mt-0.5 shrink-0 text-brand" />
          <span>
            <span className="block font-semibold">Como calculamos</span>
            <span className="block text-[0.9rem] text-ink-soft">A conta é pública e igual para todo mundo.</span>
          </span>
        </Link>
      </div>

      <Sheet open={open === "receipt"} title={TITLE.receipt} onClose={close}>
        <p className="mb-4 text-ink-soft">
          O QR Code do cupom fiscal prova o preço que você pagou, a loja e o horário. Não precisa de conta.
        </p>
        <ReceiptImport />
      </Sheet>
      <Sheet open={open === "howItWorks"} title={TITLE.howItWorks} onClose={close}>
        <HowItWorks />
      </Sheet>
    </>
  );
}
