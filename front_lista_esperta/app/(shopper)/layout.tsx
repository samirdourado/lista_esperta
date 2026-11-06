import { AppHeader } from "@/components/layout/AppHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

/** Shopper area: the home page, open to everyone without an account. */
export default function ShopperLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <main id="content" className="flex flex-1 flex-col pb-8">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
