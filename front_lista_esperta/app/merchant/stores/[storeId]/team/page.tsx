import type { Metadata } from "next";
import { TeamView } from "@/components/merchant/dashboard/TeamView";

export const metadata: Metadata = { title: "Equipe da loja" };

export default function Page() {
  return <TeamView />;
}
