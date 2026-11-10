import { Suspense } from "react";
import { HomePanels } from "@/components/home/HomePanels";
import { ShoppingListEditor } from "@/components/list/ShoppingListEditor";
import { PageHeading } from "@/components/ui/PageHeading";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-8 pb-12 sm:pt-12">
      <PageHeading
        title="Onde sua lista sai mais barata hoje?"
        lead="Escolha os produtos ou fotografe a lista. A gente mostra onde ela sai mais barata nos mercados perto de você. Não precisa de conta."
      />
      <ShoppingListEditor />
      {/* Reads ?painel= from the URL. */}
      <Suspense>
        <HomePanels />
      </Suspense>
    </div>
  );
}
