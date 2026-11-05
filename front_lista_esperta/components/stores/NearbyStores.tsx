"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinIcon } from "@/components/icons";
import { LocationPrompt } from "@/components/location/LocationPrompt";
import { StoreMap } from "@/components/map/StoreMap";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import { cx } from "@/lib/cx";
import { readPreferences, writePreferences } from "@/lib/device/device-store";
import { useLocation } from "@/lib/location/use-location";
import { useSession } from "@/lib/session";
import { useNearbyStores } from "@/lib/stores/queries";
import { StoreSummary } from "./StoreSummary";

const RADII = [1, 2, 5, 10];
/** Same cap as StoresGeoRepository.findNearby. */
const MAX_RESULTS = 200;

export function NearbyStores() {
  const location = useLocation();
  const { data: user } = useSession();
  const [chosenRadius, setChosenRadius] = useState<number | null>(null);
  const [deviceRadius, setDeviceRadius] = useState(5);
  const [changing, setChanging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    readPreferences()
      .then((prefs) => setDeviceRadius(prefs.radiusKm))
      .catch(() => undefined);
  }, []);
  // What the person picked now, else the account preference, else this device.
  const radiusKm = chosenRadius ?? user?.defaultRadiusKm ?? deviceRadius;

  const nearby = useNearbyStores(location.point, radiusKm);
  const stores = nearby.data?.stores ?? [];
  const pending = (nearby.data?.pendingAreas ?? 0) > 0;

  const chooseRadius = (value: number) => {
    setChosenRadius(value);
    void writePreferences({ radiusKm: value }).catch(() => undefined);
  };

  const select = (id: string) => {
    setSelectedId(id);
    itemRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  if (!location.point || changing) {
    return (
      <div className="mt-8 max-w-xl">
        <LocationPrompt
          status={location.status}
          onLocate={async () => {
            if ((await location.locate()) === "ready") setChanging(false);
          }}
          onPick={(place) => {
            location.setManual({ lat: place.lat, lng: place.lng }, place.label);
            setChanging(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-ink-soft">
          <MapPinIcon className="shrink-0 text-accent" />
          <span className="truncate">
            {location.source === "address" && location.label
              ? location.label.split(",").slice(0, 2).join(",")
              : location.source === "saved"
                ? "Perto da sua última localização"
                : "Perto de você"}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="min-h-tap font-semibold text-brand underline underline-offset-4"
        >
          Mudar local
        </button>
      </div>

      <fieldset className="mt-3">
        <legend className="sr-only">Distância máxima</legend>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="font-medium text-ink-soft">
            Até
          </span>
          {RADII.map((value) => (
            <label
              key={value}
              className={cx(
                "inline-flex min-h-tap cursor-pointer items-center rounded-full border px-3.5 font-medium tabular-nums",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
                radiusKm === value
                  ? "border-brand bg-brand text-on-brand"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="radius"
                value={value}
                checked={radiusKm === value}
                onChange={() => chooseRadius(value)}
                className="sr-only"
              />
              <span className="sr-only">até </span>
              {value} km
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <StoreMap
          center={location.point}
          stores={stores}
          selectedId={selectedId}
          onSelect={select}
          className="h-64 md:sticky md:top-[calc(var(--header-h)+1rem)] md:order-2 md:h-[min(36rem,70vh)]"
        />

        <section aria-labelledby="stores-heading" className="md:order-1">
          <h2 id="stores-heading" className="sr-only">
            Lojas encontradas
          </h2>
          <div role="status" aria-live="polite">
            {nearby.isPending && <p className="text-ink-soft">Procurando lojas…</p>}
            {nearby.isSuccess && (
              <p className="text-ink-soft">
                {stores.length === 0
                  ? pending
                    ? "Buscando as lojas desta região. Isso leva até um minuto na primeira vez."
                    : `Nenhuma loja encontrada em até ${radiusKm} km.`
                  : `${stores.length >= MAX_RESULTS ? `As ${MAX_RESULTS} lojas mais próximas` : `${stores.length} ${stores.length === 1 ? "loja" : "lojas"}`} em até ${radiusKm} km${pending ? ". Buscando mais lojas na região…" : "."}`}
              </p>
            )}
          </div>
          {nearby.isError && (
            <Notice tone="danger" title="Não conseguimos carregar as lojas" className="mt-3">
              {errorMessage(nearby.error)}
            </Notice>
          )}
          {nearby.isPending && (
            <div aria-hidden="true" className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}
          {stores.length > 0 && (
            <ul className="mt-3 divide-y divide-line">
              {stores.map((store) => (
                <li
                  key={store.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(store.id, el);
                    else itemRefs.current.delete(store.id);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(store.id)}
                    aria-pressed={selectedId === store.id}
                    className={cx(
                      "block w-full rounded-sm px-2 py-3 text-left",
                      selectedId === store.id ? "bg-brand-soft" : "hover:bg-surface-sunken",
                    )}
                  >
                    <StoreSummary store={store} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {stores.length > 0 && (
            <p className="mt-6 text-[0.85rem] text-muted">
              Lojas do OpenStreetMap e cadastradas por lojistas. Falta uma loja? Quem é dono pode cadastrá-la em “Tenho
              uma loja”.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
