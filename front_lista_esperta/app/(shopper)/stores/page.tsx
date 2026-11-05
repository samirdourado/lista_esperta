import type { Metadata } from "next";
import { NearbyStores } from "@/components/stores/NearbyStores";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Lojas por perto" };

export default function StoresPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8">
      <PageHeading
        title="Lojas por perto"
        lead="Mercados, farmácias, materiais de construção, pet shops e outras lojas físicas perto de você."
      />
      <NearbyStores />
    </div>
  );
}
