import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertsView } from "@/components/alerts/AlertsView";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Alertas de preço" };

export default function AlertsPage() {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-8 pb-16">
      <PageHeading
        title="Alertas de preço"
        lead="Diga quanto quer pagar e avisamos quando alguma loja perto de você chegar lá."
      />
      <Suspense fallback={<Skeleton className="mt-6 h-40 w-full" />}>
        <AlertsView />
      </Suspense>
    </div>
  );
}
