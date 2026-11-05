"use client";

import { useEffect, useId, useState } from "react";
import { TextField } from "@/components/ui/Field";
import { errorMessage } from "@/lib/api/errors";
import { useAddressSearch, type GeocodedPlace } from "@/lib/stores/queries";

/**
 * Type an address, pick one of the results. Waits for a pause in typing:
 * the free address service accepts one request per second for everyone.
 */
export function AddressSearch({
  label = "Digite um endereço ou bairro",
  hint,
  onPick,
}: {
  label?: string;
  hint?: string;
  onPick: (place: GeocodedPlace) => void;
}) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const listId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 600);
    return () => clearTimeout(timer);
  }, [text]);

  const search = useAddressSearch(query);
  const results = search.data ?? [];
  const searching = search.isFetching || (text.trim().length >= 3 && text !== query);

  return (
    <div>
      <TextField
        label={label}
        hint={hint}
        type="search"
        autoComplete="street-address"
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-controls={listId}
        placeholder="Rua, número e cidade"
      />
      <div id={listId} role="status" aria-live="polite" className="mt-2">
        {searching && <p className="text-[0.9rem] text-ink-soft">Procurando endereços…</p>}
        {!searching && search.isError && <p className="text-[0.9rem] text-danger">{errorMessage(search.error)}</p>}
        {!searching && search.isSuccess && results.length === 0 && (
          <p className="text-[0.9rem] text-ink-soft">Nenhum endereço encontrado. Inclua a cidade na busca.</p>
        )}
        {!searching && results.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
            {results.map((place) => (
              <li key={`${place.lat},${place.lng}`}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(place);
                    setText(place.label);
                    setQuery("");
                  }}
                  className="block min-h-tap w-full px-3.5 py-2.5 text-left hover:bg-brand-soft"
                >
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
