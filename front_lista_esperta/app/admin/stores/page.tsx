import type { Metadata } from "next";
import { StoresView } from "@/components/admin/AdminViews";

export const metadata: Metadata = { title: "Verificações · Admin" };

export default function Page() {
  return <StoresView />;
}
