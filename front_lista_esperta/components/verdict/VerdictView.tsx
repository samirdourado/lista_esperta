import Link from "next/link";
import { SaveListsInvite } from "@/components/auth/SaveListsInvite";
import { Notice } from "@/components/ui/Notice";
import { PANEL_HREF } from "@/lib/panels";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import type { Verdict } from "@/lib/verdict/queries";
import { BestStore, ItemLines, OtherStores, SplitCard, UnpricedStores } from "./ranking";
import { SponsoredBlock } from "./SponsoredBlock";

/** Lays out the neutral answer first and, apart from it, the sponsored block. */
export function VerdictView({
  verdict,
  items,
  selectedId,
  onSelect,
}: {
  verdict: Verdict;
  items: ShoppingListItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [best, ...others] = verdict.ranking;
  const unpriced = verdict.items.filter((item) => !item.priced);

  if (!best) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="info" title="Ainda não temos preços desses itens perto de você">
          {verdict.params.pendingAreas > 0
            ? "Estamos buscando as lojas desta região. Tente de novo em um minuto."
            : `Nenhuma loja em até ${verdict.params.radiusKm.toLocaleString("pt-BR")} km tem preço para a sua lista. Aumente a distância ou ajude enviando a nota de uma compra.`}
        </Notice>
        <Link href={PANEL_HREF.receipt} className="min-h-tap font-semibold text-brand underline underline-offset-4">
          Enviar uma nota fiscal
        </Link>
        <UnpricedStores stores={verdict.unpricedStores} total={verdict.params.storesWithoutPrices} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div data-store={best.store.id}>
        <BestStore best={best} />
      </div>
      <SplitCard verdict={verdict} items={items} />

      <section aria-labelledby="best-items">
        <h2 id="best-items" className="text-2xl font-bold">
          Sua lista em {best.store.name}
        </h2>
        <ItemLines store={best} items={items} verdict={verdict} />
      </section>

      {unpriced.length > 0 && (
        <Notice
          tone="warning"
          title={`${unpriced.length} ${unpriced.length === 1 ? "item ficou" : "itens ficaram"} de fora`}
        >
          Nenhuma loja por perto tem preço para: {unpriced.map((item) => item.text).join(", ")}. A comparação vale para
          o resto da lista.
        </Notice>
      )}

      <OtherStores ranking={others} selectedId={selectedId} onSelect={onSelect} />
      <UnpricedStores stores={verdict.unpricedStores} total={verdict.params.storesWithoutPrices} />

      <p className="text-[0.85rem] text-muted">
        {verdict.params.routing === "ESTIMATE"
          ? "Distâncias estimadas em linha reta com acréscimo para as ruas."
          : "Distâncias e tempos de carro calculados pelo OpenRouteService."}{" "}
        {verdict.params.storesClosed > 0 && `${verdict.params.storesClosed} lojas fechadas agora ficaram de fora. `}O
        ranking considera só o preço da lista.{" "}
        <Link href={PANEL_HREF.howItWorks} className="underline underline-offset-4">
          Como calculamos
        </Link>
      </p>

      <SponsoredBlock items={verdict.sponsored} />
      <SaveListsInvite />
    </div>
  );
}
