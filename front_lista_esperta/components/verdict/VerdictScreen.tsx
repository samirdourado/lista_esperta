"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPinIcon } from "@/components/icons";
import { LocationPrompt } from "@/components/location/LocationPrompt";
import { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import { cx } from "@/lib/cx";
import { useLocation } from "@/lib/location/use-location";
import { useCurrentList } from "@/lib/shopping-lists/current";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import { useSearchPreferences } from "@/lib/verdict/preferences";
import { useVerdict } from "@/lib/verdict/queries";
import { VerdictView } from "./VerdictView";

const RADII = [1, 2, 5, 10];

/** Loads the list, the location and the search radius, then asks the API. */
export function VerdictScreen() {
  const { load } = useCurrentList();
  const location = useLocation();
  const { preferences, save } = useSearchPreferences();
  const [items, setItems] = useState<ShoppingListItem[] | null>(null);
  const [changingPlace, setChangingPlace] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((list) => !cancelled && setItems(list?.items ?? []))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const input =
    items && items.length > 0 && location.point && preferences && !changingPlace
      ? { origin: location.point, items, radiusKm: preferences.radiusKm }
      : null;
  const verdict = useVerdict(input);

  if (items === null) return <Skeleton className="mt-8 h-40 w-full" />;
  if (items.length === 0) {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <p className="text-ink-soft">Sua lista está vazia.</p>
        <Link href="/" className={cx(buttonClasses({ size: "lg" }), "self-start")}>
          Montar minha lista
        </Link>
      </div>
    );
  }
  if (!location.point || changingPlace) {
    return (
      <div className="mt-8">
        <LocationPrompt
          status={location.status}
          intro="Para comparar as lojas perto de você, precisamos saber de onde você sai."
          onLocate={async () => {
            if ((await location.locate()) === "ready") setChangingPlace(false);
          }}
          onPick={(place) => {
            location.setManual({ lat: place.lat, lng: place.lng }, place.label);
            setChangingPlace(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[0.95rem]">
        <p className="flex min-w-0 items-center gap-1.5 text-ink-soft">
          <MapPinIcon className="shrink-0 text-accent" />
          <span className="truncate">
            {items.length} {items.length === 1 ? "item" : "itens"} ·{" "}
            {location.source === "address" && location.label
              ? location.label.split(",").slice(0, 2).join(",")
              : "perto de você"}
          </span>
        </p>
        <span className="flex gap-4">
          <button
            type="button"
            className="min-h-tap font-semibold text-brand underline underline-offset-4"
            onClick={() => setChangingPlace(true)}
          >
            Mudar local
          </button>
          <Link
            href="/"
            className="inline-flex min-h-tap items-center font-semibold text-brand underline underline-offset-4"
          >
            Editar lista
          </Link>
        </span>
      </div>

      {preferences && (
        <details className="rounded-md border border-line bg-surface px-4 py-1">
          <summary className="min-h-tap cursor-pointer content-center font-medium">
            Lojas até {preferences.radiusKm} km de você
          </summary>
          <div className="mt-2 mb-3 flex flex-col gap-4">
            <fieldset>
              <legend className="font-medium">Distância máxima</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {RADII.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={preferences.radiusKm === value}
                    onClick={() => void save({ radiusKm: value })}
                    className={cx(
                      "min-h-tap rounded-full border px-4 font-medium",
                      preferences.radiusKm === value ? "border-brand bg-brand text-on-brand" : "border-line bg-surface",
                    )}
                  >
                    {value} km
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </details>
      )}

      {verdict.isPending && (
        <div aria-busy="true">
          <p role="status" className="text-ink-soft">
            Comparando sua lista nas lojas por perto…
          </p>
          <Skeleton className="mt-4 h-16 w-3/4" />
          <Skeleton className="mt-6 h-28 w-64" />
        </div>
      )}
      {verdict.isError && (
        <Notice tone="danger" title="Não conseguimos comparar agora">
          {errorMessage(verdict.error)}
        </Notice>
      )}
      {verdict.data && <VerdictView verdict={verdict.data} items={items} />}
    </div>
  );
}
