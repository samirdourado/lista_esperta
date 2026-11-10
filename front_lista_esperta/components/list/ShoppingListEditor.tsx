"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { normalizeText } from "@/lib/directory/match";
import { useCurrentList } from "@/lib/shopping-lists/current";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import { useParseListPhoto } from "@/lib/verdict/queries";
import { ProductPicker } from "./ProductPicker";

const PHOTO_ERROR: Record<string, string> = {
  PHOTO_UNAVAILABLE: "A leitura de fotos não está disponível agora. Escolha os produtos na lista.",
  PHOTO_SERVICE_UNAVAILABLE: "A leitura de fotos não respondeu agora. Tente de novo em instantes.",
  PHOTO_UNREADABLE: "Não conseguimos ler essa foto. Tente com mais luz e a lista inteira na imagem.",
};

/**
 * The list: generic products picked by category or by name, several at a
 * time, or read from a photo of a handwritten list (D-080). Saved on the
 * device (or the account) as it changes. Stores are compared only on
 * "Ver onde comprar".
 */
export function ShoppingListEditor() {
  const router = useRouter();
  const { load, save } = useCurrentList();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const photo = useParseListPhoto();

  useEffect(() => {
    let cancelled = false;
    load()
      .then((list) => {
        if (!cancelled && list) setItems(list.items);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Autosave, so the list survives a reload or going offline.
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => void save(items).catch(() => undefined), 500);
    return () => clearTimeout(timer);
  }, [items, loaded, save]);

  /** Adds new names; a name already on the list is not repeated. */
  const add = (lines: { freeText: string; quantity: number }[]) =>
    setItems((current) => {
      const seen = new Set(current.map((item) => normalizeText(item.freeText)));
      const fresh = lines.filter((line) => {
        const key = normalizeText(line.freeText);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return [...current, ...fresh];
    });

  const setQuantity = (index: number, quantity: number) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, quantity) } : item)),
    );

  const photoError =
    photo.error instanceof ApiError && photo.error.code
      ? PHOTO_ERROR[photo.error.code]
      : photo.error
        ? errorMessage(photo.error)
        : null;

  return (
    <div className="mt-8 flex flex-col gap-6">
      <ProductPicker
        inList={items.map((item) => item.freeText)}
        onAdd={(labels) => add(labels.map((freeText) => ({ freeText, quantity: 1 })))}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="secondary" onClick={() => photoInput.current?.click()} loading={photo.isPending}>
          Foto da lista
        </Button>
        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file)
              photo.mutate(file, {
                onSuccess: (lines) => add(lines.map((line) => ({ freeText: line.text, quantity: line.quantity }))),
              });
          }}
        />
      </div>
      {photo.isPending && (
        <p role="status" className="text-ink-soft">
          Lendo a foto da lista…
        </p>
      )}
      {photoError && <Notice tone="danger" title={photoError} />}

      {items.length > 0 && (
        <section aria-labelledby="list-heading">
          <h2 id="list-heading" className="text-2xl font-bold">
            Sua lista · {items.length} {items.length === 1 ? "item" : "itens"}
          </h2>
          <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-surface">
            {items.map((item, index) => (
              <li key={`${item.freeText}-${index}`} className="flex min-h-11 items-center gap-2 px-3 py-1">
                <span className="line-clamp-2 min-w-0 flex-1 leading-snug">{item.freeText}</span>
                <span className="flex items-center" role="group" aria-label={`Quantidade de ${item.freeText}`}>
                  <button
                    type="button"
                    onClick={() => setQuantity(index, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    aria-label="Diminuir"
                    className="size-tap rounded-full text-xl text-ink-soft hover:bg-surface-sunken disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-8 text-center tabular-nums" aria-live="polite">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(index, item.quantity + 1)}
                    aria-label="Aumentar"
                    className="size-tap rounded-full text-xl text-ink-soft hover:bg-surface-sunken"
                  >
                    +
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Remover ${item.freeText}`}
                  className="size-tap rounded-full text-ink-soft hover:bg-surface-sunken hover:text-danger"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={async () => {
                await save(items).catch(() => undefined);
                router.push("/verdict");
              }}
            >
              Ver onde comprar
            </Button>
            <button
              type="button"
              onClick={() => setItems([])}
              className="min-h-tap px-2 font-medium text-ink-soft underline underline-offset-4"
            >
              Limpar lista
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
