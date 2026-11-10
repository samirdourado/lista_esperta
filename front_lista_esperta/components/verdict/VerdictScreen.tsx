"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LocationBar } from "@/components/location/LocationBar";
import { LocationPrompt } from "@/components/location/LocationPrompt";
import { StoreMap, type MapStore } from "@/components/map/StoreMap";
import { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import { cx } from "@/lib/cx";
import { brl } from "@/lib/format";
import { useLocation } from "@/lib/location/use-location";
import { useCurrentList } from "@/lib/shopping-lists/current";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import { useSearchPreferences } from "@/lib/verdict/preferences";
import { useVerdict, type Verdict } from "@/lib/verdict/queries";
import { MAX_RADIUS_KM, MIN_RADIUS_KM, RadiusSlider } from "./RadiusSlider";
import { VerdictView } from "./VerdictView";

const clampRadius = (value: number) => Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, value));

/** Only stores that price something on the list, each with the list price there. */
export function mapStores(verdict: Verdict | undefined): MapStore[] {
  if (!verdict) return [];
  return verdict.ranking.map((entry) => ({ ...entry.store, label: brl(entry.itemsCost) }));
}

/**
 * The list, where the person starts from and how far they go → the stores
 * nearby where the list is cheapest, in a list beside a map.
 */
export function VerdictScreen() {
  const { load } = useCurrentList();
  const location = useLocation();
  const { preferences, save } = useSearchPreferences();
  const [items, setItems] = useState<ShoppingListItem[] | null>(null);
  const [changingPlace, setChangingPlace] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Ask for the location as soon as the page opens, unless a trusted place is saved (D-075).
  const { status, locate } = location;
  const asked = useRef(false);
  useEffect(() => {
    if (status !== "idle" || asked.current) return;
    asked.current = true;
    void locate();
  }, [status, locate]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((list) => !cancelled && setItems(list?.items ?? []))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const radiusKm = preferences ? clampRadius(preferences.radiusKm) : null;
  const input =
    items && items.length > 0 && location.point && radiusKm && !changingPlace
      ? { origin: location.point, items, radiusKm }
      : null;
  // The hook keeps the last answer on screen while a new radius loads.
  const verdict = useVerdict(input);
  const commitRadius = useCallback((value: number) => void save({ radiusKm: value }), [save]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    document.querySelector(`[data-store="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

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
      <div className="mt-8 max-w-xl">
        <LocationPrompt
          status={location.status}
          intro="Para mostrar as lojas mais perto de você, precisamos saber de onde você sai."
          approximateM={location.approximate?.accuracyM}
          onUseApproximate={() => {
            location.acceptApproximate();
            setChangingPlace(false);
          }}
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
    <div className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <LocationBar location={location} onChange={() => setChangingPlace(true)} />
        <p className="text-[0.95rem] text-ink-soft">
          {items.length} {items.length === 1 ? "item" : "itens"} na lista ·{" "}
          <Link href="/" className="font-semibold text-brand underline underline-offset-4">
            Editar lista
          </Link>
        </p>
      </div>

      {radiusKm && <RadiusSlider value={radiusKm} onCommit={commitRadius} />}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <StoreMap
          center={location.point}
          stores={mapStores(verdict.data)}
          selectedId={selectedId ?? verdict.data?.ranking[0]?.store.id ?? null}
          onSelect={select}
          radiusKm={radiusKm ?? undefined}
          className="h-72 md:sticky md:top-[calc(var(--header-h)+1rem)] md:order-2 md:h-[min(40rem,75vh)]"
        />

        <div
          className={cx("min-w-0 md:order-1", verdict.isFetching && verdict.data && "opacity-60 transition-opacity")}
        >
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
          {verdict.data && (
            <VerdictView verdict={verdict.data} items={items} selectedId={selectedId} onSelect={select} />
          )}
        </div>
      </div>
    </div>
  );
}
