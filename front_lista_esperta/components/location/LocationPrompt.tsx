"use client";

import { CrosshairIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { LocationStatus } from "@/lib/location/use-location";
import type { GeocodedPlace } from "@/lib/stores/queries";
import { AddressSearch } from "./AddressSearch";

/** Asks for the location only when the person taps; an address works too. */
export function LocationPrompt({
  status,
  onLocate,
  onPick,
  intro = "Para mostrar as lojas perto de você, precisamos saber onde você está.",
}: {
  status: LocationStatus;
  onLocate: () => void;
  onPick: (place: GeocodedPlace) => void;
  intro?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink-soft">{intro}</p>
      <Button
        size="lg"
        onClick={onLocate}
        loading={status === "locating"}
        icon={<CrosshairIcon />}
        className="self-start"
      >
        Usar minha localização
      </Button>
      {status === "denied" && (
        <Notice tone="warning" title="O navegador não liberou sua localização">
          Você pode digitar um endereço abaixo, ou liberar a localização nas configurações do navegador.
        </Notice>
      )}
      {status === "unavailable" && (
        <Notice tone="warning" title="Não conseguimos achar sua localização agora">
          Digite um endereço abaixo.
        </Notice>
      )}
      <AddressSearch label="Ou digite um endereço" onPick={onPick} />
    </div>
  );
}
