"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import { cx } from "@/lib/cx";
import { brl } from "@/lib/format";
import { packLabel } from "@/lib/merchant/labels";
import {
  useEndOffer,
  useSetPrices,
  useStoreCatalog,
  useWithdrawProduct,
  type CatalogItem,
} from "@/lib/merchant/queries";
import { AddProductPanel } from "./AddProductPanel";
import { moneyInput, parseMoney } from "./money";
import { useStoreId } from "./StoreShell";

const DAY = 24 * 60 * 60 * 1000;
const dateInput = (date: Date) => date.toISOString().slice(0, 10);

/** Comparison with the median of other stores nearby, in words. */
function RegionNote({ item }: { item: CatalogItem }) {
  if (item.regionMedian === null || item.regularPrice === null) {
    return <span className="text-muted">Sem preços de outras lojas por perto</span>;
  }
  const diff = (item.regularPrice - item.regionMedian) / item.regionMedian;
  const label =
    Math.abs(diff) < 0.01
      ? "igual à mediana"
      : `${Math.round(Math.abs(diff) * 100)} % ${diff < 0 ? "abaixo" : "acima"} da mediana`;
  return (
    <span className={diff > 0.01 ? "text-warning" : diff < -0.01 ? "text-success" : "text-ink-soft"}>
      {label} ({brl(item.regionMedian)}, {item.regionStores} {item.regionStores === 1 ? "loja" : "lojas"})
    </span>
  );
}

export function CatalogView() {
  const storeId = useStoreId();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [saved, setSaved] = useState<string>();

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const catalog = useStoreCatalog(storeId, q);
  const setPrices = useSetPrices(storeId);
  const withdraw = useWithdrawProduct(storeId);
  const endOffer = useEndOffer(storeId);
  const items = useMemo(() => catalog.data ?? [], [catalog.data]);

  const changes = useMemo(
    () =>
      Object.entries(edits)
        .map(([productId, raw]) => ({
          productId,
          price: parseMoney(raw),
          item: items.find((i) => i.productId === productId),
        }))
        .filter((change) => change.item && change.price !== change.item.regularPrice),
    [edits, items],
  );
  const invalid = changes.filter((change) => change.price === null);

  const saveAll = async () => {
    setSaved(undefined);
    await setPrices.mutateAsync(changes.map((change) => ({ productId: change.productId, price: change.price! })));
    setSaved(`${changes.length} ${changes.length === 1 ? "preço atualizado" : "preços atualizados"}.`);
    setEdits({});
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <TextField
            label="Buscar nos seus produtos"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou código de barras"
          />
        </div>
        <Button variant={adding ? "ghost" : "primary"} onClick={() => setAdding(!adding)}>
          {adding ? "Fechar" : "Adicionar produto"}
        </Button>
      </div>

      {adding && (
        <AddProductPanel
          storeId={storeId}
          onDone={() => {
            setAdding(false);
            setSaved("Produto adicionado.");
          }}
        />
      )}
      {saved && <Notice tone="success" title={saved} />}
      {(setPrices.isError || withdraw.isError || endOffer.isError) && (
        <Notice tone="danger" title={errorMessage(setPrices.error ?? withdraw.error ?? endOffer.error)} />
      )}

      {catalog.isPending && <Skeleton className="h-48 w-full" />}
      {catalog.isSuccess && items.length === 0 && (
        <p className="text-ink-soft">
          {q
            ? "Nenhum produto encontrado com essa busca."
            : "Nenhum produto com preço ainda. Use “Adicionar produto” ou importe uma planilha."}
        </p>
      )}

      <ul className="divide-y divide-line rounded-md border border-line bg-surface">
        {items.map((item) => {
          const value = edits[item.productId] ?? moneyInput(item.regularPrice);
          const changed = edits[item.productId] !== undefined && parseMoney(value) !== item.regularPrice;
          return (
            <li key={item.productId} className={cx("flex flex-col gap-3 p-4", changed && "bg-brand-soft/50")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-semibold">{item.canonicalName}</p>
                  <p className="text-[0.9rem] text-ink-soft">
                    {packLabel(item.unit, item.unitQuantity)}
                    {item.gtin && ` · ${item.gtin}`}
                  </p>
                  <p className="text-[0.9rem]">
                    <RegionNote item={item} />
                  </p>
                  {item.divergent && item.receiptPrice !== null && (
                    <p className="text-[0.9rem] font-medium text-danger">
                      Nota fiscal recente: {brl(item.receiptPrice)}
                    </p>
                  )}
                </div>
                <div className="w-32">
                  <TextField
                    label={`Preço de ${item.canonicalName}`}
                    hideLabel
                    inputMode="decimal"
                    value={value}
                    error={changed && parseMoney(value) === null ? "Preço inválido" : undefined}
                    onChange={(e) => setEdits({ ...edits, [item.productId]: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.95rem]">
                {item.offerId ? (
                  <>
                    <span className="rounded-sm bg-accent-soft px-2 py-0.5 font-medium text-ink">
                      Oferta {brl(item.offerPrice!)} até {new Date(item.offerValidUntil!).toLocaleDateString("pt-BR")}
                    </span>
                    <button
                      type="button"
                      className="min-h-tap font-medium text-brand underline underline-offset-4"
                      onClick={() => endOffer.mutate(item.offerId!)}
                    >
                      Encerrar oferta
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="min-h-tap font-medium text-brand underline underline-offset-4"
                    onClick={() => setOfferFor(offerFor === item.productId ? null : item.productId)}
                  >
                    Criar oferta
                  </button>
                )}
                <button
                  type="button"
                  className="min-h-tap font-medium text-ink-soft underline underline-offset-4 hover:text-danger"
                  onClick={() => {
                    if (window.confirm(`Tirar “${item.canonicalName}” da sua loja?`)) withdraw.mutate(item.productId);
                  }}
                >
                  Não vendo mais
                </button>
              </div>
              {offerFor === item.productId && (
                <OfferForm storeId={storeId} item={item} onDone={() => setOfferFor(null)} />
              )}
            </li>
          );
        })}
      </ul>

      {changes.length > 0 && (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand bg-surface p-3 shadow-lg">
          <span>
            {changes.length} {changes.length === 1 ? "preço alterado" : "preços alterados"}
            {invalid.length > 0 && <span className="text-danger"> · corrija os preços inválidos</span>}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEdits({})}>
              Descartar
            </Button>
            <Button onClick={() => void saveAll()} loading={setPrices.isPending} disabled={invalid.length > 0}>
              Salvar alterações
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OfferForm({ storeId, item, onDone }: { storeId: string; item: CatalogItem; onDone: () => void }) {
  const [price, setPrice] = useState("");
  // Dates are fixed when the form opens (render must stay pure).
  const [limits] = useState(() => {
    const now = Date.now();
    return {
      min: dateInput(new Date(now)),
      max: dateInput(new Date(now + 90 * DAY)),
      week: dateInput(new Date(now + 7 * DAY)),
    };
  });
  const [until, setUntil] = useState(limits.week);
  const [error, setError] = useState<string>();
  const setPrices = useSetPrices(storeId);

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md bg-surface-sunken p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const value = parseMoney(price);
        const end = new Date(`${until}T23:59:59-03:00`);
        if (value === null) return setError("Informe o preço da oferta.");
        if (item.regularPrice !== null && value >= item.regularPrice)
          return setError("A oferta precisa ser menor que o preço normal.");
        try {
          await setPrices.mutateAsync([{ productId: item.productId, price: value, validUntil: end.toISOString() }]);
          onDone();
        } catch (e) {
          setError(errorMessage(e, { 400: "A oferta precisa terminar nos próximos 90 dias." }));
        }
      }}
    >
      <div className="w-32">
        <TextField
          label="Preço da oferta"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <TextField
        label="Válida até"
        type="date"
        value={until}
        min={limits.min}
        max={limits.max}
        onChange={(e) => setUntil(e.target.value)}
      />
      <Button type="submit" loading={setPrices.isPending}>
        Publicar oferta
      </Button>
      {error && <p className="w-full text-[0.9rem] font-medium text-danger">{error}</p>}
    </form>
  );
}
