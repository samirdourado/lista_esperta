import type { Metadata } from "next";
import { ImportView } from "@/components/merchant/dashboard/ImportView";

export const metadata: Metadata = { title: "Importar planilha" };

export default function Page() {
  return <ImportView />;
}
