import type { Metadata } from "next";
import { MyStoresPanel } from "@/components/merchant/MyStoresPanel";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Painel do lojista" };

export default function MerchantHomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8">
      <PageHeading
        title="Painel do lojista"
        lead="Escolha a loja para cuidar dos produtos, preços, ofertas e equipe."
      />
      <div className="mt-8">
        <MyStoresPanel />
      </div>
    </div>
  );
}
