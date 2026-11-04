import type { Metadata } from "next";
import { NfceChecker } from "@/components/NfceChecker";

export const metadata: Metadata = { title: "Enviar nota fiscal" };

export default function ReceiptImportPage() {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-8 pb-16">
      <h1 className="font-display text-[clamp(2.4rem,10vw,3.4rem)] leading-[0.95] font-bold tracking-tight">
        Envie a nota da sua compra
      </h1>
      <p className="mt-3 text-ink-soft">
        O QR Code do cupom fiscal prova o preço que você pagou, a loja e o horário. Cada nota atualiza os preços para
        quem mora perto.
      </p>
      <NfceChecker />
    </div>
  );
}
