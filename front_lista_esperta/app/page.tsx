import { Suspense } from "react";
import { ListForm } from "@/components/ListForm";
import { PILOT_NAME } from "@/lib/demo/stores";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-8 sm:pt-12">
      <h1 className="font-display text-[clamp(2.6rem,11vw,3.75rem)] font-bold leading-[0.95] tracking-tight text-balance">
        Onde sua lista sai mais barata hoje?
      </h1>
      <p className="mt-3 max-w-136 text-ink-soft">
        Escreva, cole ou fotografe a lista. A gente compara os mercados perto de você e conta também o
        custo de ir até lá.
      </p>
      <Suspense fallback={<div className="ruled mt-8 h-64 rounded-lg border border-line" />}>
        <ListForm />
      </Suspense>
      <p className="mt-10 text-[0.9rem] text-muted">
        Preços disponíveis por enquanto na {PILOT_NAME}, em São Paulo. Os dados desta versão são simulados.
      </p>
    </main>
  );
}
