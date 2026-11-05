import type { Metadata } from "next";
import { FlyersView } from "@/components/merchant/dashboard/FlyersView";

export const metadata: Metadata = { title: "Encartes" };

export default function Page() {
  return <FlyersView />;
}
