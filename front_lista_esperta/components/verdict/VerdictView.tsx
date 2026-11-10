"use client";

import Link from "next/link";
import { useState } from "react";
import { SaveListsInvite } from "@/components/auth/SaveListsInvite";
import { Notice } from "@/components/ui/Notice";
import { brl } from "@/lib/format";
import { PANEL_HREF } from "@/lib/panels";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import type { Verdict } from "@/lib/verdict/queries";
import { PriceSourceCredit, SplitCard, StoreAccordion } from "./ranking";
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
  const best = verdict.ranking[0];
  // Open by default: the store picked on the map or, at first, the cheapest.
  const [closedId, setClosedId] = useState<string | null>(null);
  const unpriced = verdict.items.filter((item) => !item.priced);

  if (!best) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="info" title="Ainda não temos preços desses itens perto de você">
          {`Nenhuma loja em até ${verdict.params.radiusKm.toLocaleString("pt-BR")} km tem preço para a sua lista. Aumente a distância no seletor acima ou envie a nota de uma compra feita por perto: cada nota coloca os preços daquela loja no mapa.`}
        </Notice>
        <Link href={PANEL_HREF.receipt} className="min-h-tap font-semibold text-brand underline underline-offset-4">
          Enviar uma nota fiscal
        </Link>
      </div>
    );
  }

  const current = selectedId ?? best.store.id;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold">Onde sua lista está mais barata</h2>
      <StoreAccordion
        ranking={verdict.ranking}
        items={items}
        verdict={verdict}
        expandedId={closedId === current ? null : current}
        onToggle={(id) => {
          if (id === current && closedId !== id) {
            setClosedId(id);
            return;
          }
          setClosedId(null);
          onSelect?.(id);
        }}
      />
      <PriceSourceCredit ranking={verdict.ranking} />
      <SplitCard verdict={verdict} items={items} />

      {unpriced.length > 0 && (
        <Notice
          tone="warning"
          title={`${unpriced.length} ${unpriced.length === 1 ? "item ficou" : "itens ficaram"} de fora`}
        >
          Nenhuma loja por perto tem preço para:{" "}
          {unpriced
            .map((item) =>
              item.webPrice ? `${item.text} (na internet a partir de ${brl(item.webPrice.price)})` : item.text,
            )
            .join(", ")}
          . A comparação vale para o resto da lista.
        </Notice>
      )}

      <p className="text-[0.85rem] text-muted">
        {verdict.params.routing === "ESTIMATE"
          ? "Distâncias estimadas em linha reta com acréscimo para as ruas."
          : "Distâncias e tempos de carro calculados pelo OpenRouteService."}{" "}
        {verdict.params.storesClosed > 0 && `${verdict.params.storesClosed} lojas fechadas agora ficaram de fora. `}
        Lojas ordenadas pelo preço da lista; quem não tem um item conta a mediana da região para a comparação ser justa.{" "}
        <Link href={PANEL_HREF.howItWorks} className="underline underline-offset-4">
          Como calculamos
        </Link>
      </p>

      <SponsoredBlock items={verdict.sponsored} />
      <SaveListsInvite />
    </div>
  );
}
