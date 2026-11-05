"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { cx } from "@/lib/cx";
import { parseLine, splitLines } from "@/lib/list/line";
import { useProductSearch } from "@/lib/merchant/queries";
import { useCurrentList } from "@/lib/shopping-lists/current";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import { useParseListPhoto } from "@/lib/verdict/queries";

const EXAMPLE = ["arroz 5 kg", "2 leite integral", "café 500 g", "detergente", "papel higiênico"];

const PHOTO_ERROR: Record<string, string> = {
  PHOTO_UNAVAILABLE: "A leitura de fotos não está disponível agora. Digite a lista.",
  PHOTO_SERVICE_UNAVAILABLE: "A leitura de fotos não respondeu agora. Tente de novo em instantes.",
  PHOTO_UNREADABLE: "Não conseguimos ler essa foto. Tente com mais luz e a lista inteira na imagem.",
};

/**
 * The list: type with catalog autocomplete, paste several lines, or take a
 * photo of a handwritten list. Saved on the device (or the account) as you type.
 */
export function ShoppingListEditor() {
  const router = useRouter();
  const { load, save } = useCurrentList();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const inputId = useId();
  const listboxId = useId();
  const photoInput = useRef<HTMLInputElement>(null);
  const photo = useParseListPhoto();
  const suggestions = useProductSearch(query).data ?? [];
  const open = query.length >= 2 && suggestions.length > 0;

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

  useEffect(() => {
    const timer = setTimeout(() => setQuery(parseLine(text).text), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const add = (lines: { freeText: string; quantity: number; productId?: string | null }[]) => {
    setItems((current) => [...current, ...lines.filter((line) => line.freeText)]);
  };

  const addTyped = () => {
    const lines = splitLines(text).map((line) => {
      const parsed = parseLine(line);
      return { freeText: parsed.text, quantity: parsed.quantity };
    });
    add(lines);
    setText("");
    setQuery("");
    setActive(-1);
  };

  const choose = (index: number) => {
    const product = suggestions[index];
    if (!product) return;
    add([{ freeText: product.canonicalName, quantity: parseLine(text).quantity, productId: product.id }]);
    setText("");
    setQuery("");
    setActive(-1);
  };

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
    <div className="mt-8 flex flex-col gap-5">
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          if (open && active >= 0) choose(active);
          else if (text.trim()) addTyped();
        }}
      >
        <label htmlFor={inputId} className="font-medium">
          Adicionar item
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id={inputId}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setActive(-1);
            }}
            onKeyDown={(event) => {
              if (!open) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, suggestions.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, -1));
              } else if (event.key === "Escape") {
                setQuery("");
              }
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text");
              if (splitLines(pasted).length > 1) {
                event.preventDefault();
                add(
                  splitLines(pasted).map((line) => ({
                    freeText: parseLine(line).text,
                    quantity: parseLine(line).quantity,
                  })),
                );
              }
            }}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listboxId}-${active}` : undefined}
            autoComplete="off"
            placeholder="Ex.: 2 leite integral"
            className="block min-h-tap w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 text-lg placeholder:text-muted focus:border-brand focus:outline-none"
          />
          <Button type="submit" disabled={!text.trim()}>
            Adicionar
          </Button>
        </div>
        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Produtos do catálogo"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-line bg-surface shadow-lg"
          >
            {suggestions.map((product, index) => (
              <li
                key={product.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(index);
                }}
                className={cx(
                  "min-h-tap cursor-pointer px-3.5 py-2.5",
                  index === active ? "bg-brand-soft" : "hover:bg-surface-sunken",
                )}
              >
                {product.canonicalName}
              </li>
            ))}
          </ul>
        )}
      </form>

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
        {items.length === 0 && loaded && (
          <button
            type="button"
            className="min-h-tap font-medium underline underline-offset-4"
            onClick={() =>
              add(EXAMPLE.map((line) => ({ freeText: parseLine(line).text, quantity: parseLine(line).quantity })))
            }
          >
            Usar uma lista de exemplo
          </button>
        )}
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
              <li key={`${item.freeText}-${index}`} className="flex min-h-11 items-center gap-2 px-3">
                <span className="min-w-0 flex-1 truncate">{item.freeText}</span>
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
