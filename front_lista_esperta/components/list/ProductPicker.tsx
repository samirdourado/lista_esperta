"use client";

import { useId, useMemo, useState } from "react";
import { CartPlusIcon, CheckIcon, SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { CATEGORIES, searchCatalog, type GenericProduct } from "@/lib/catalog/generic-products";
import { cx } from "@/lib/cx";
import { normalizeText } from "@/lib/directory/match";

const ALL = "todas";

/**
 * Pick generic products by category, or type to narrow the list (D-080).
 * Several can be checked and added at once; what is already on the list
 * leaves the options.
 */
export function ProductPicker({
  inList,
  onAdd,
}: {
  /** Names already on the list (they are not offered again). */
  inList: string[];
  onAdd: (labels: string[]) => void;
}) {
  const [category, setCategory] = useState(ALL);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const searchId = useId();
  const listId = useId();

  const taken = useMemo(() => new Set(inList.map(normalizeText)), [inList]);
  const typing = text.trim().length > 0;
  // While typing, search every category: the person may not know where it lives.
  const scope = useMemo(
    () =>
      typing || category === ALL
        ? CATEGORIES.flatMap((c) => c.products)
        : (CATEGORIES.find((c) => c.id === category)?.products ?? []),
    [category, typing],
  );
  const options = useMemo(
    () => searchCatalog(text, scope).filter((product) => !taken.has(normalizeText(product.label))),
    [text, scope, taken],
  );

  const toggle = (product: GenericProduct) =>
    setChecked((current) =>
      current.includes(product.label)
        ? current.filter((label) => label !== product.label)
        : [...current, product.label],
    );

  const addChecked = () => {
    if (checked.length === 0) return;
    onAdd(checked);
    setChecked([]);
  };

  const typed = text.trim();
  const unknown = typing && options.length === 0 && !taken.has(normalizeText(typed));

  return (
    <section aria-labelledby={`${searchId}-title`} className="flex flex-col gap-3">
      <h2 id={`${searchId}-title`} className="sr-only">
        Escolher produtos
      </h2>

      <div>
        <label htmlFor={searchId} className="font-medium">
          Buscar produto
        </label>
        <div className="relative mt-1.5">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input
            id={searchId}
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (checked.length > 0) addChecked();
              else if (options.length === 1) onAdd([options[0].label]);
              else if (unknown) {
                onAdd([typed]);
                setText("");
              }
            }}
            aria-controls={listId}
            autoComplete="off"
            placeholder="Ex.: arroz, café, água com gás"
            className="block min-h-tap w-full rounded-md border border-line-strong bg-surface pr-3.5 pl-11 text-lg placeholder:text-muted focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div role="group" aria-label="Categorias" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ id: ALL, label: "Todas" }, ...CATEGORIES].map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={!typing && category === item.id}
            onClick={() => {
              setCategory(item.id);
              setText("");
            }}
            className={cx(
              "min-h-tap shrink-0 rounded-full border px-4 font-medium whitespace-nowrap",
              !typing && category === item.id
                ? "border-brand bg-brand text-on-brand"
                : "border-line bg-surface hover:border-line-strong",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-line bg-surface">
        <p aria-live="polite" className="border-b border-line px-3 py-2 text-[0.9rem] text-ink-soft">
          {options.length === 0
            ? typing
              ? "Nenhum produto da lista com esse nome."
              : "Todos os produtos desta categoria já estão na sua lista."
            : `${options.length} ${options.length === 1 ? "produto" : "produtos"}${checked.length > 0 ? ` · ${checked.length} marcado${checked.length === 1 ? "" : "s"}` : ""}`}
        </p>
        <ul id={listId} aria-label="Produtos" className="max-h-80 divide-y divide-line overflow-y-auto">
          {options.map((product) => {
            const on = checked.includes(product.label);
            return (
              <li key={product.id}>
                <label
                  className={cx(
                    "flex min-h-tap cursor-pointer items-center gap-3 px-3 py-2",
                    on ? "bg-brand-soft" : "hover:bg-surface-sunken",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(product)}
                    className="size-5 shrink-0 accent-[var(--brand)]"
                  />
                  <span className="min-w-0 flex-1">{product.label}</span>
                  {on && <CheckIcon className="shrink-0 text-brand" />}
                </label>
              </li>
            );
          })}
        </ul>
        {unknown && (
          <div className="border-t border-line px-3 py-2">
            <button
              type="button"
              onClick={() => {
                onAdd([typed]);
                setText("");
              }}
              className="min-h-tap font-semibold text-brand underline underline-offset-4"
            >
              Adicionar “{typed}” como escrito
            </button>
          </div>
        )}
      </div>

      <Button onClick={addChecked} disabled={checked.length === 0} icon={<CartPlusIcon />} className="self-start">
        {checked.length === 0
          ? "Marque os produtos"
          : `Adicionar ${checked.length} ${checked.length === 1 ? "item" : "itens"} à lista`}
      </Button>
    </section>
  );
}
