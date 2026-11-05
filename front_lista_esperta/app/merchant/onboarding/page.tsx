import type { Metadata } from "next";
import { PendingClaims } from "@/components/merchant/MyStoresPanel";
import { OnboardingFlow } from "@/components/merchant/OnboardingFlow";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Cadastrar loja" };

/** Merchants without a store land here (proxy.ts); others come to add one more. */
export default function MerchantOnboardingPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8">
      <PageHeading
        title="Coloque sua loja no mapa"
        lead="Encontre sua loja entre as que já aparecem para os clientes, ou cadastre-a. Leva poucos minutos."
      />
      <div className="mt-6">
        <PendingClaims />
      </div>
      <OnboardingFlow />
    </div>
  );
}
