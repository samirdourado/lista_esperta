"use client";

import { MapPinIcon } from "@/components/icons";
import { IMPRECISE_M, type LocationState } from "@/lib/location/use-location";
import { type GeocodedPlace, usePlaceName } from "@/lib/stores/queries";

/** "Rua Tal, Bairro" from a geocoder label: street and district are enough to recognise. */
export function shortPlace(label: string): string {
  return label.split(",").slice(0, 3).join(",").trim();
}

/** Street, number and district when the geocoder knows them; its label otherwise. */
export function placeName(place: GeocodedPlace): string {
  const { street, number, district, city } = place.address ?? {};
  if (!street) return shortPlace(place.label);
  return [number ? `${street}, ${number}` : street, district ?? city].filter(Boolean).join(" · ");
}

/**
 * Where the comparison starts from, in words, so a wrong GPS guess is easy to
 * spot and fix ("Mudar local").
 */
export function LocationBar({ location, onChange }: { location: LocationState; onChange: () => void }) {
  const reverse = usePlaceName(location.source === "address" ? undefined : location.point);
  const place =
    location.source === "address" && location.label
      ? shortPlace(location.label)
      : reverse.data
        ? placeName(reverse.data)
        : "perto de você";
  const imprecise = location.source === "gps" && (location.accuracyM ?? 0) > IMPRECISE_M;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <p className="flex min-w-0 items-center gap-1.5 text-ink-soft">
          <MapPinIcon className="shrink-0 text-accent" />
          <span className="min-w-0 truncate">
            {location.source === "saved" ? "Última localização: " : "Saindo de: "}
            <span className="font-medium text-ink">{place}</span>
          </span>
        </p>
        <button
          type="button"
          className="min-h-tap font-semibold text-brand underline underline-offset-4"
          onClick={onChange}
        >
          Mudar local
        </button>
      </div>
      {imprecise && (
        <p role="status" className="text-[0.9rem] text-warning">
          O navegador só conseguiu uma localização aproximada (±
          {((location.accuracyM ?? 0) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km). Se o endereço
          acima não for o seu, toque em Mudar local e digite o CEP ou a rua.
        </p>
      )}
    </div>
  );
}
