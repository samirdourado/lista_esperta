import type { Metadata } from "next";
import { OverviewView } from "@/components/merchant/dashboard/OverviewView";

export const metadata: Metadata = { title: "Painel da loja" };

export default function Page() {
  return <OverviewView />;
}
