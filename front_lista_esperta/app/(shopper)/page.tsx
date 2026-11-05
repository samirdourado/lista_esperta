import { ShoppingListEditor } from "@/components/list/ShoppingListEditor";
import { PageHeading } from "@/components/ui/PageHeading";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-8 sm:pt-12">
      <PageHeading
        title="Onde sua lista sai mais barata hoje?"
        lead="Escreva ou fotografe a lista. A gente compara as lojas perto de você e conta também o custo de ir até lá. Não precisa de conta."
      />
      <ShoppingListEditor />
    </div>
  );
}
