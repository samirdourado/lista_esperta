import type { Metadata } from "next";
import { CatalogModerationView } from "@/components/admin/AdminViews";

export const metadata: Metadata = { title: "Catálogo · Admin" };

export default function Page() {
  return <CatalogModerationView />;
}
