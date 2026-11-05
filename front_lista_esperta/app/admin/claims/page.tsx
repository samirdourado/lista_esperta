import type { Metadata } from "next";
import { ClaimsView } from "@/components/admin/AdminViews";

export const metadata: Metadata = { title: "Reivindicações · Admin" };

export default function Page() {
  return <ClaimsView />;
}
