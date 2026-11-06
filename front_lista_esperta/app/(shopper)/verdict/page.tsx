import type { Metadata } from "next";
import { VerdictScreen } from "@/components/verdict/VerdictScreen";

export const metadata: Metadata = { title: "Onde comprar" };

export default function VerdictPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6">
      <h1 className="sr-only">Onde sua lista sai mais barata</h1>
      <VerdictScreen />
    </div>
  );
}
