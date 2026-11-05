"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { packLabel, UNIT_OPTIONS } from "@/lib/merchant/labels";
import {
  useCategories,
  useCreateProduct,
  useGtinLookup,
  useProductSearch,
  useSetPrices,
  type MeasureUnit,
  type Product,
} from "@/lib/merchant/queries";
import { parseMoney } from "./money";

type Draft = { gtin: string; name: string; brand: string; categorySlug: string; unit: MeasureUnit; quantity: string };
const EMPTY_DRAFT: Draft = { gtin: "", name: "", brand: "", categorySlug: "", unit: "UN", quantity: "1" };
const isBarcode = (value: string) => /^\d{8,14}$/.test(value.replace(/\s/g, ""));

/**
 * Add a product to the store: by barcode (catalog, then Open Food Facts) or
 * by name; anything not found is registered by hand.
 */
export function AddProductPanel({ storeId, onDone }: { storeId: string; onDone: () => void }) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string>();
  const lookup = useGtinLookup();
  const search = useProductSearch(isBarcode(query) ? "" : query);
  const create = useCreateProduct();
  const setPrices = useSetPrices(storeId);
  const categories = useCategories();
  const priceId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 400);
    return () => clearTimeout(timer);
  }, [term]);

  const findBarcode = async () => {
    setError(undefined);
    const gtin = term.replace(/\D/g, "");
    try {
      const result = await lookup.mutateAsync(gtin);
      if (result.product) setChosen(result.product);
      else if (result.suggestion) {
        const s = result.suggestion;
        setDraft({
          gtin,
          name: s.name,
          brand: s.brand ?? "",
          categorySlug: s.categorySlug ?? "",
          unit: s.unit ?? "UN",
          quantity: String(s.unitQuantity ?? 1),
        });
      } else setDraft({ ...EMPTY_DRAFT, gtin });
    } catch (e) {
      setError(errorMessage(e, { 400: "Esse código de barras não é válido." }));
    }
  };

  const save = async () => {
    setError(undefined);
    const value = parseMoney(price);
    if (value === null) {
      setError("Informe o preço, como 12,90.");
      return;
    }
    try {
      let product = chosen;
      if (!product && draft) {
        const quantity = Number(draft.quantity.replace(",", "."));
        if (!draft.name.trim() || !draft.categorySlug || !(quantity > 0)) {
          setError("Preencha nome, categoria e quantidade do produto.");
          return;
        }
        try {
          product = await create.mutateAsync({
            ...(draft.gtin ? { gtin: draft.gtin } : {}),
            canonicalName: draft.name.trim(),
            ...(draft.brand.trim() ? { brand: draft.brand.trim() } : {}),
            categorySlug: draft.categorySlug,
            unit: draft.unit,
            unitQuantity: quantity,
          });
        } catch (e) {
          if (e instanceof ApiError && e.code === "GTIN_TAKEN") {
            product = { id: String(e.body.productId) } as Product;
          } else throw e;
        }
      }
      if (!product) return;
      await setPrices.mutateAsync([{ productId: product.id, price: value }]);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const options = (categories.data ?? []).flatMap((top) => [
    { slug: top.slug, label: top.name },
    ...top.children.map((child) => ({ slug: child.slug, label: `${top.name} › ${child.name}` })),
  ]);

  return (
    <section aria-labelledby="add-product" className="rounded-md border border-line bg-surface p-4">
      <h2 id="add-product" className="text-xl font-bold">
        Adicionar produto
      </h2>
      {error && <Notice tone="danger" title={error} className="mt-3" />}

      {!chosen && !draft && (
        <div className="mt-3 flex flex-col gap-3">
          <TextField
            label="Código de barras ou nome"
            hint="Digite o código impresso na embalagem (EAN) ou parte do nome."
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            inputMode={isBarcode(term) ? "numeric" : "text"}
          />
          {isBarcode(term) ? (
            <Button onClick={() => void findBarcode()} loading={lookup.isPending} className="self-start">
              Buscar pelo código
            </Button>
          ) : (
            <div role="status" aria-live="polite">
              {(search.data ?? []).length > 0 && (
                <ul className="divide-y divide-line rounded-md border border-line">
                  {search.data!.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => setChosen(product)}
                        className="block min-h-tap w-full px-3 py-2 text-left hover:bg-brand-soft"
                      >
                        <span className="font-medium">{product.canonicalName}</span>{" "}
                        <span className="text-[0.9rem] text-ink-soft">
                          {packLabel(product.unit, product.unitQuantity)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.length >= 2 && search.isSuccess && (
                <Button variant="ghost" onClick={() => setDraft({ ...EMPTY_DRAFT, name: query })} className="mt-2">
                  Cadastrar “{query}” como produto novo
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {draft && !chosen && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-ink-soft">
            {draft.gtin && draft.name
              ? "Encontramos este produto no Open Food Facts. Confira os dados."
              : "Cadastre o produto no catálogo."}
          </p>
          <TextField
            label="Nome do produto"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <TextField
            label="Marca (opcional)"
            value={draft.brand}
            onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
          />
          <label className="flex flex-col gap-1.5 font-medium">
            Categoria
            <select
              value={draft.categorySlug}
              onChange={(e) => setDraft({ ...draft, categorySlug: e.target.value })}
              className="min-h-tap rounded-md border border-line-strong bg-surface px-3 font-normal"
            >
              <option value="">Escolha…</option>
              {options.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 font-medium">
              Vendido em
              <select
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value as MeasureUnit })}
                className="min-h-tap rounded-md border border-line-strong bg-surface px-3 font-normal"
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Quantidade"
              inputMode="decimal"
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
            />
          </div>
        </div>
      )}

      {chosen && (
        <p className="mt-3">
          <span className="font-semibold">{chosen.canonicalName ?? "Produto do catálogo"}</span>{" "}
          {chosen.unit && <span className="text-ink-soft">{packLabel(chosen.unit, chosen.unitQuantity)}</span>}
        </p>
      )}

      {(chosen || draft) && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <TextField
              id={priceId}
              label="Preço (R$)"
              inputMode="decimal"
              placeholder="0,00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <Button onClick={() => void save()} loading={create.isPending || setPrices.isPending}>
            Salvar preço
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setChosen(null);
              setDraft(null);
              setPrice("");
            }}
          >
            Escolher outro produto
          </Button>
        </div>
      )}
    </section>
  );
}
