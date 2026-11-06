"use client";

import { CrosshairIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { LocationStatus } from "@/lib/location/use-location";
import type { GeocodedPlace } from "@/lib/stores/queries";
import { AddressSearch } from "./AddressSearch";

const kmText = (metres: number) => (metres / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** The device location, or a CEP / address typed by the person (D-075). */
export function LocationPrompt({
  status,
  onLocate,
  onPick,
  approximateM,
  onUseApproximate,
  intro = "Para mostrar as lojas perto de você, precisamos saber onde você está.",
}: {
  status: LocationStatus;
  onLocate: () => void;
  onPick: (place: GeocodedPlace) => void;
  /** Accuracy of the wide guess the browser gave, when status is "imprecise". */
  approximateM?: number;
  onUseApproximate?: () => void;
  intro?: string;
}) {
  if (status === "imprecise") {
    return (
      <div className="flex flex-col gap-5">
        <Notice tone="warning" title="Seu aparelho só informou a região, não o endereço">
          A localização veio com margem de {approximateM ? `${kmText(approximateM)} km` : "alguns km"}. Isso acontece em
          computadores e celulares sem GPS ligado. Digite seu CEP para vermos as lojas certas; ele fica salvo neste
          aparelho.
        </Notice>
        <AddressSearch label="Seu CEP ou endereço" autoFocus onPick={onPick} />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={onLocate}
            className="min-h-tap font-semibold text-brand underline underline-offset-4"
          >
            Tentar a localização de novo
          </button>
          {onUseApproximate && (
            <button
              type="button"
              onClick={onUseApproximate}
              className="min-h-tap font-medium text-ink-soft underline underline-offset-4"
            >
              Usar a região aproximada mesmo assim
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink-soft">{intro}</p>
      <Button
        size="lg"
        onClick={onLocate}
        loading={status === "locating" || status === "checking"}
        icon={<CrosshairIcon />}
        className="self-start"
      >
        {status === "locating" ? "Buscando sua localização…" : "Usar minha localização"}
      </Button>
      {status === "denied" && (
        <Notice tone="warning" title="O navegador não liberou sua localização">
          Digite seu CEP abaixo, ou libere a localização nas configurações do navegador.
        </Notice>
      )}
      {status === "unavailable" && (
        <Notice tone="warning" title="Não conseguimos achar sua localização agora">
          Digite seu CEP abaixo.
        </Notice>
      )}
      <AddressSearch label="Ou digite seu CEP ou endereço" onPick={onPick} />
    </div>
  );
}
