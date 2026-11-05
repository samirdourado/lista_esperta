import type { Metadata } from "next";
import { SettingsView } from "@/components/merchant/dashboard/SettingsView";

export const metadata: Metadata = { title: "Dados e fotos da loja" };

export default function Page() {
  return <SettingsView />;
}
