import type { Metadata } from "next";
import { AdminOverviewView } from "@/components/admin/AdminViews";

export const metadata: Metadata = { title: "Moderação · Admin" };

export default function Page() {
  return <AdminOverviewView />;
}
