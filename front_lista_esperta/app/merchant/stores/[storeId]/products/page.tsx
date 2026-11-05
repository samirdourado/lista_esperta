import type { Metadata } from "next";
import { CatalogView } from "@/components/merchant/dashboard/CatalogView";

export const metadata: Metadata = { title: "Produtos e preços" };

export default function Page() {
  return <CatalogView />;
}
