import type { Metadata } from "next";
import { ReceiptImport } from "@/components/receipts/ReceiptImport";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Enviar nota fiscal" };

export default function ReceiptImportPage() {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-8 pb-16">
      <PageHeading
        title="Envie a nota da sua compra"
        lead="O QR Code do cupom fiscal prova o preço que você pagou, a loja e o horário. Cada nota atualiza os preços para quem compra perto. Não precisa de conta."
      />
      <ReceiptImport />
    </div>
  );
}
