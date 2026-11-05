"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { brl } from "@/lib/format";
import { type FlyerImport, useFlyers, useImportFlyer } from "@/lib/merchant/queries";
import { useStoreId } from "./StoreShell";

export const FLYER_ERROR: Record<string, string> = {
  FLYER_UNAVAILABLE: "A leitura de encartes não está configurada neste servidor.",
  FLYER_QUOTA: "A leitura de encartes atingiu o limite de uso. Tente de novo mais tarde.",
  FLYER_SERVICE_UNAVAILABLE: "A leitura de encartes não respondeu agora. Tente de novo em instantes.",
  FLYER_FETCH_FAILED: "Não conseguimos abrir esse link. Confira se ele abre sem login.",
  FLYER_EMPTY: "Não encontramos texto nesse link. Se o encarte é uma imagem, envie o link do PDF.",
  FLYER_UNREADABLE: "Não conseguimos ler esse encarte.",
  FLYER_NO_PRICES: "Não encontramos produtos com preço nesse encarte.",
  FLYER_EXPIRED: "As ofertas desse encarte já terminaram.",
};

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const STATUS = {
  MATCHED: { tone: "success", label: "Entrou" },
  PENDING: { tone: "warning", label: "Em revisão" },
  UNMATCHED: { tone: "neutral", label: "Não reconhecido" },
} as const;

function flyerError(error: unknown): string {
  if (error instanceof ApiError && error.code && FLYER_ERROR[error.code]) return FLYER_ERROR[error.code];
  return errorMessage(error);
}

function Result({ flyer }: { flyer: FlyerImport }) {
  return (
    <div className="flex flex-col gap-3">
      <Notice
        tone={flyer.pricesAdded > 0 ? "success" : "warning"}
        title={`${flyer.pricesAdded} ${flyer.pricesAdded === 1 ? "preço entrou" : "preços entraram"} na comparação`}
      >
        {flyer.itemsFound} produtos lidos
        {flyer.validUntil ? `, válidos até ${DATE.format(new Date(flyer.validUntil))}` : ""}.
        {flyer.pending > 0 &&
          ` ${flyer.pending} ${flyer.pending === 1 ? "fica" : "ficam"} em revisão até a equipe confirmar o produto.`}
      </Notice>
      <ul className="divide-y divide-line rounded-md border border-line bg-surface">
        {flyer.items.map((item, index) => (
          <li key={index} className="flex items-start justify-between gap-3 px-3 py-2">
            <span className="min-w-0">
              <span className="block">{item.description}</span>
              {item.productName && item.productName !== item.description && (
                <span className="block text-[0.85rem] text-ink-soft">{item.productName}</span>
              )}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="tabular-nums">{brl(item.price)}</span>
              <Badge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The store's flyer, read from a public link (page or PDF). Source FLYER. */
export function FlyersView() {
  const storeId = useStoreId();
  const flyers = useFlyers(storeId);
  const importFlyer = useImportFlyer(storeId);
  const [url, setUrl] = useState("");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <p className="text-ink-soft">
        Cole o link do encarte da loja (página ou PDF). A gente lê os produtos e preços, e eles aparecem como{" "}
        <strong className="text-ink">Encarte da loja</strong> até o fim das ofertas. Sem data no encarte, valem por 7
        dias.
      </p>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (url.trim()) importFlyer.mutate(url.trim());
        }}
      >
        <TextField
          id="flyer-url"
          label="Link do encarte"
          type="url"
          inputMode="url"
          placeholder="https://"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" loading={importFlyer.isPending}>
          Ler encarte
        </Button>
      </form>
      {importFlyer.isPending && (
        <p role="status" className="text-ink-soft">
          Lendo o encarte. Isso pode levar até um minuto…
        </p>
      )}
      {importFlyer.isError && <Notice tone="danger" title={flyerError(importFlyer.error)} />}
      {importFlyer.data && <Result flyer={importFlyer.data} />}

      <section aria-labelledby="flyer-history">
        <h2 id="flyer-history" className="text-lg font-bold">
          Encartes enviados
        </h2>
        {flyers.isPending && <Skeleton className="mt-2 h-20 w-full" />}
        {flyers.data?.length === 0 && <p className="mt-2 text-ink-soft">Nenhum encarte ainda.</p>}
        <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-surface empty:hidden">
          {(flyers.data ?? []).map((flyer) => (
            <li key={flyer.id} className="px-3 py-2">
              <p className="truncate">
                <a href={flyer.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">
                  {flyer.title ?? flyer.url}
                </a>
              </p>
              <p className="text-[0.85rem] text-ink-soft">
                {DATE.format(new Date(flyer.createdAt))} ·{" "}
                {flyer.status === "DONE"
                  ? `${flyer.pricesAdded} de ${flyer.itemsFound} preços${flyer.validUntil ? ` · até ${DATE.format(new Date(flyer.validUntil))}` : ""}`
                  : (FLYER_ERROR[flyer.error ?? ""] ?? "Não foi lido")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
