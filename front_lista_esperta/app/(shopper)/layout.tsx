import { AppHeader } from "@/components/layout/AppHeader";
import { TabBar } from "@/components/layout/ShopperNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

/** Shopper area: the home page, open to everyone without an account. */
export default function ShopperLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <main id="content" className="pb-tabbar flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <TabBar />
    </>
  );
}
