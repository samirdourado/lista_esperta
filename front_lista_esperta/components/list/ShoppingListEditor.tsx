"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { cx } from "@/lib/cx";
import { brl } from "@/lib/format";
import { parseLine, splitLines } from "@/lib/list/line";
import { useLocation } from "@/lib/location/use-location";
import { useProductSearch } from "@/lib/merchant/queries";
import { useCurrentList } from "@/lib/shopping-lists/current";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import { useParseListPhoto } from "@/lib/verdict/queries";
import { useWebPriceSearch, webSearchError } from "@/lib/web-prices/queries";
import { WebOffers } from "./WebOffers";

const EXAMPLE = ["arroz 5 kg", "2 leite integral", "café 500 g", "detergente", "papel higiênico"];

const PHOTO_ERROR: Record<string, string> = {
  PHOTO_UNAVAILABLE: "A leitura de fotos não está disponível agora. Digite a lista.",
  PHOTO_SERVICE_UNAVAILABLE: "A leitura de fotos não respondeu agora. Tente de novo em instantes.",
  PHOTO_UNREADABLE: "Não conseguimos ler essa foto. Tente com mais luz e a lista inteira na imagem.",
};

/**
 * The list: type with catalog autocomplete, search the cheapest prices on
 * Google, paste several lines, or take a photo of a handwritten list. Saved on
 * the device (or the account) as you type.
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
  const location = useLocation();
  const web = useWebPriceSearch();
  /** The query sent to Google; the results panel is open while it is set. */
  const [webQuery, setWebQuery] = useState<string | null>(null);
  const relocating = useRef(false);
  const offers = webQuery ? (web.data?.offers ?? []) : [];
  const open = !webQuery && query.length >= 2 && suggestions.length > 0;
  const optionCount = webQuery ? offers.length : open ? suggestions.length : 0;

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

  // The person allowed the location after a country-wide search: search again near them.
  const { mutate: searchWeb } = web;
  useEffect(() => {
    if (!relocating.current || !location.point || !webQuery) return;
    relocating.current = false;
    searchWeb({ query: webQuery, point: location.point });
  }, [location.point, webQuery, searchWeb]);

  const add = (lines: ShoppingListItem[]) => {
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

  const closeWeb = () => {
    setWebQuery(null);
    setActive(-1);
  };

  const searchPrices = () => {
    const wanted = parseLine(text).text.trim();
    if (wanted.length < 2) return;
    setWebQuery(wanted);
    setQuery("");
    setActive(-1);
    // Near the shopper when we can: ask for the location once, else search the whole country.
    if (!location.point && location.status === "idle") {
      relocating.current = true;
      void location.locate().then((status) => {
        if (status === "ready") return; // the effect below searches with the new point
        relocating.current = false;
        searchWeb({ query: wanted });
      });
      return;
    }
    searchWeb({ query: wanted, point: location.point });
  };

  const chooseOffer = (index: number) => {
    const offer = offers[index];
    if (!offer || !web.data) return;
    add([
      {
        freeText: offer.title,
        quantity: parseLine(text).quantity,
        webPrice: {
          title: offer.title,
          price: offer.price,
          store: offer.store,
          url: offer.url,
          seenAt: web.data.searchedAt,
        },
      },
    ]);
    setText("");
    setQuery("");
    closeWeb();
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
          if (webQuery && active >= 0) chooseOffer(active);
          else if (open && active >= 0) choose(active);
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
              if (webQuery) setWebQuery(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                closeWeb();
                return;
              }
              if (optionCount === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, optionCount - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, -1));
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
            aria-expanded={open || Boolean(webQuery)}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listboxId}-${active}` : undefined}
            autoComplete="off"
            placeholder="Ex.: 2 leite integral"
            className="block min-h-tap w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 text-lg placeholder:text-muted focus:border-brand focus:outline-none"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={searchPrices}
            disabled={parseLine(text).text.trim().length < 2}
            loading={web.isPending}
            icon={<SearchIcon />}
            aria-label="Pesquisar preços"
            className="px-3 sm:px-4"
          >
            <span className="hidden sm:inline">Pesquisar</span>
          </Button>
          <Button type="submit" disabled={!text.trim()}>
            Adicionar
          </Button>
        </div>
        <p className="mt-1.5 text-[0.9rem] text-ink-soft">
          Toque em <SearchIcon className="inline align-[-0.2em]" /> para ver os menores preços na internet.
        </p>
        {webQuery && (
          <div className="absolute inset-x-0 top-[calc(100%-1.75rem)] z-20 mt-1 max-h-[26rem] overflow-auto rounded-md border border-line bg-surface shadow-lg">
            <div className="flex items-start justify-between gap-2 border-b border-line px-3 py-2">
              <p className="text-[0.9rem] text-ink-soft">
                Mais baratos no Google para <strong className="text-ink">{webQuery}</strong>
                {web.data &&
                  (web.data.location ? (
                    ` · ${web.data.location}`
                  ) : (
                    <>
                      {" · Brasil · "}
                      <button
                        type="button"
                        className="font-medium text-brand underline underline-offset-4"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          relocating.current = true;
                          void location.locate();
                        }}
                      >
                        usar minha localização
                      </button>
                    </>
                  ))}
              </p>
              <button
                type="button"
                onClick={closeWeb}
                aria-label="Fechar resultados"
                className="-my-1 size-tap shrink-0 rounded-full text-xl text-ink-soft hover:bg-surface-sunken"
              >
                ×
              </button>
            </div>
            {(web.isPending || location.status === "locating") && (
              <p role="status" className="px-3 py-4 text-ink-soft">
                {location.status === "locating" ? "Vendo onde você está…" : "Buscando os menores preços…"}
              </p>
            )}
            {web.isError && (
              <p role="alert" className="px-3 py-4 text-danger">
                {webSearchError(web.error)}
              </p>
            )}
            {web.isSuccess && offers.length === 0 && (
              <p role="status" className="px-3 py-4 text-ink-soft">
                Nada encontrado no Google para “{webQuery}”. Tente outro nome ou toque em Adicionar.
              </p>
            )}
            {web.isSuccess && offers.length > 0 && (
              <>
                <WebOffers id={listboxId} offers={offers} active={active} onChoose={chooseOffer} />
                <p className="border-t border-line px-3 py-2 text-[0.8rem] text-muted">
                  Preços de lojas online na sua região, só como referência. A comparação usa os mercados perto de você.
                </p>
              </>
            )}
          </div>
        )}
        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Produtos do catálogo"
            className="absolute inset-x-0 top-[calc(100%-1.75rem)] z-20 mt-1 max-h-72 overflow-auto rounded-md border border-line bg-surface shadow-lg"
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
              <li key={`${item.freeText}-${index}`} className="flex min-h-11 items-center gap-2 px-3 py-1">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 leading-snug">{item.freeText}</span>
                  {item.webPrice && (
                    <span className="block text-[0.85rem] text-ink-soft">
                      Na internet: {brl(item.webPrice.price)} em {item.webPrice.store}
                    </span>
                  )}
                </span>
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
