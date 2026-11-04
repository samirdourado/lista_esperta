import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountView } from "@/components/account/AccountView";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Minha conta" };

export default function AccountPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-8">
      <PageHeading title="Minha conta" />
      <Suspense fallback={<p className="mt-8 text-ink-soft">Carregando sua conta…</p>}>
        <AccountView />
      </Suspense>
    </div>
  );
}
