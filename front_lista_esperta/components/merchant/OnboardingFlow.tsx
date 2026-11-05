"use client";

import Link from "next/link";
import { useState } from "react";
import { LocationPrompt } from "@/components/location/LocationPrompt";
import { StoreSummary } from "@/components/stores/StoreSummary";
import { Button, buttonClasses } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { api } from "@/lib/api/client";
import { codeMessage } from "@/lib/api/errors";
import type { Point } from "@/lib/location/use-location";
import { useLocation } from "@/lib/location/use-location";
import {
  useClaimableStores,
  type ClaimResult,
  type CreateStoreResult,
  type Store,
  type StoreAddress,
} from "@/lib/stores/queries";
import { ClaimPanel } from "./ClaimPanel";
import { StoreForm } from "./StoreForm";

type Step =
  | { kind: "start" }
  | { kind: "match"; point: Point; address?: StoreAddress }
  | { kind: "claim"; store: Store; back: Step }
  | { kind: "form"; point: Point; address?: StoreAddress }
  | { kind: "created"; result: CreateStoreResult }
  | { kind: "claimed"; result: ClaimResult };

const STEP_TITLE: Record<Step["kind"], string> = {
  start: "Onde fica sua loja?",
  match: "Sua loja já está no mapa?",
  claim: "Confirme que a loja é sua",
  form: "Dados da loja",
  created: "Loja cadastrada",
  claimed: "Pedido enviado",
};

async function addressAt(point: Point): Promise<StoreAddress | undefined> {
  const result = await api.GET("/api/v1/geocoding/reverse", { params: { query: point } });
  return result.data?.address;
}

/**
 * Merchant onboarding: find the shop on the map and claim it, or register it
 * when it is not there. Duplicates are caught by the API (POSSIBLE_DUPLICATE).
 */
export function OnboardingFlow() {
  const [step, setStep] = useState<Step>({ kind: "start" });
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const location = useLocation();

  const goMatch = (point: Point, address?: StoreAddress) => {
    if (name.trim().length < 2) {
      setNameError("Informe o nome da loja.");
      return;
    }
    setNameError(undefined);
    setStep({ kind: "match", point, address });
  };

  return (
    <section aria-labelledby="onboarding-step" className="mt-8">
      <h2 id="onboarding-step" className="text-3xl font-bold" tabIndex={-1}>
        {STEP_TITLE[step.kind]}
      </h2>

      {step.kind === "start" && (
        <div className="mt-5 flex flex-col gap-6">
          <TextField
            label="Nome da loja"
            hint="Como aparece na fachada."
            value={name}
            error={nameError}
            onChange={(event) => setName(event.target.value)}
          />
          <LocationPrompt
            status={location.status}
            intro="Se você está na loja agora, use sua localização. Se não, digite o endereço."
            onLocate={async () => {
              if ((await location.locate()) !== "ready") return;
            }}
            onPick={(place) => goMatch({ lat: place.lat, lng: place.lng }, place.address)}
          />
          {location.status === "ready" && location.point && location.source === "gps" && (
            <Button
              size="lg"
              className="self-start"
              onClick={async () => {
                const point = location.point!;
                goMatch(point, await addressAt(point).catch(() => undefined));
              }}
            >
              Continuar com minha localização
            </Button>
          )}
        </div>
      )}

      {step.kind === "match" && (
        <MatchStep
          point={step.point}
          name={name}
          onClaim={(store) => setStep({ kind: "claim", store, back: step })}
          onRegister={() => setStep({ kind: "form", point: step.point, address: step.address })}
          onBack={() => setStep({ kind: "start" })}
        />
      )}

      {step.kind === "claim" && (
        <div className="mt-5">
          <ClaimPanel
            store={step.store}
            onBack={() => setStep(step.back)}
            onDone={(result) => setStep({ kind: "claimed", result })}
          />
        </div>
      )}

      {step.kind === "form" && (
        <div className="mt-5">
          <StoreForm
            initialName={name}
            initialPoint={step.point}
            initialAddress={step.address}
            onCreated={(result) => setStep({ kind: "created", result })}
            onClaimInstead={async (hint) => {
              const candidates = await api.GET("/api/v1/stores/claimable", {
                params: { query: { ...step.point, q: hint.storeName } },
              });
              const store = candidates.data?.find((s) => s.id === hint.storeId);
              if (store) setStep({ kind: "claim", store, back: step });
            }}
          />
        </div>
      )}

      {step.kind === "created" && <CreatedStep result={step.result} />}
      {step.kind === "claimed" && <ClaimedStep result={step.result} />}
    </section>
  );
}

function MatchStep({
  point,
  name,
  onClaim,
  onRegister,
  onBack,
}: {
  point: Point;
  name: string;
  onClaim: (store: Store) => void;
  onRegister: () => void;
  onBack: () => void;
}) {
  const claimable = useClaimableStores(point, name);
  const stores = (claimable.data ?? []).filter((store) => !store.managed);
  return (
    <div className="mt-5 flex flex-col gap-4">
      <p role="status" className="text-ink-soft">
        {claimable.isPending
          ? "Procurando lojas neste endereço…"
          : stores.length > 0
            ? "Encontramos estas lojas perto do endereço. Se uma delas é a sua, peça para administrá-la."
            : "Não encontramos lojas neste endereço. Cadastre a sua."}
      </p>
      {claimable.isError && <Notice tone="danger" title="Não conseguimos buscar as lojas agora." />}
      {stores.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {stores.slice(0, 8).map((store) => (
            <li key={store.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <StoreSummary store={store} />
              <Button variant="secondary" onClick={() => onClaim(store)} className="shrink-0">
                Esta é a minha loja
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onRegister}>
          {stores.length > 0 ? "Minha loja não está na lista" : "Cadastrar minha loja"}
        </Button>
        <Button variant="ghost" size="lg" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </div>
  );
}

function CreatedStep({ result }: { result: CreateStoreResult }) {
  const { verification, verificationError, store } = result;
  return (
    <div className="mt-5 flex flex-col gap-5">
      <p className="text-ink-soft">“{store.name}” já aparece para quem procura lojas por perto.</p>
      {verification?.status === "VERIFIED" && (
        <Notice tone="success" title="CNPJ conferido na Receita Federal">
          Sua loja aparece como verificada.
        </Notice>
      )}
      {verification?.status === "PENDING" && (
        <Notice tone="info" title="Vamos conferir os dados da loja">
          O CNPJ está ativo, mas o endereço não bateu por completo com o da Receita Federal. Nossa equipe confere e
          libera o selo de verificada.
        </Notice>
      )}
      {verificationError && (
        <Notice tone="warning" title="A loja foi cadastrada, mas o CNPJ não foi conferido">
          {codeMessage(verificationError) ?? "Tente de novo pelo painel."}
        </Notice>
      )}
      {!verification && !verificationError && (
        <Notice tone="info" title="Sua loja aparece como não verificada">
          Informe o CNPJ no painel quando quiser para ganhar o selo.
        </Notice>
      )}
      <Link href="/merchant" className={buttonClasses({ size: "lg" })}>
        Ir para o painel da loja
      </Link>
    </div>
  );
}

function ClaimedStep({ result }: { result: ClaimResult }) {
  if (result.autoApproved) {
    return (
      <div className="mt-5 flex flex-col gap-5">
        <Notice tone="success" title={`Agora você administra “${result.claim.store.name}”`}>
          O CNPJ bateu com o endereço na Receita Federal e a loja aparece como verificada.
        </Notice>
        <Link href="/merchant" className={buttonClasses({ size: "lg" })}>
          Ir para o painel da loja
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-5 flex flex-col gap-5">
      <Notice tone="info" title={`Pedido para administrar “${result.claim.store.name}” enviado`}>
        Nossa equipe confere e libera o acesso. Você pode acompanhar o pedido aqui no onboarding.
      </Notice>
      <Link href="/" className={buttonClasses({ variant: "secondary", size: "lg" })}>
        Voltar para a lista de compras
      </Link>
    </div>
  );
}
