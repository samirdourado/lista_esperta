import { Suspense } from "react";
import { StoreShell } from "@/components/merchant/dashboard/StoreShell";

/** One store's dashboard. proxy.ts admits merchants; the API checks membership. */
export default function StoreDashboardLayout({ children }: LayoutProps<"/merchant/stores/[storeId]">) {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-5xl px-4 pt-8 text-ink-soft">Carregando a loja…</p>}>
      <StoreShell>{children}</StoreShell>
    </Suspense>
  );
}
