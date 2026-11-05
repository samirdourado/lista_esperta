"use client";

import Link from "next/link";
import { useState } from "react";
import { addressLine, VerificationNote } from "@/components/stores/StoreSummary";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import { isValidCnpj, maskCnpj, normalizeCnpj } from "@/lib/cnpj";
import { useMyClaims, useMyStores, useVerifyStore, type MyStore } from "@/lib/stores/queries";

/** Claims still waiting for an admin. Shown on the onboarding and the dashboard. */
export function PendingClaims() {
  const claims = useMyClaims();
  const pending = (claims.data ?? []).filter((claim) => claim.status === "PENDING");
  if (pending.length === 0) return null;
  return (
    <Notice tone="info" title="Pedidos em análise">
      <ul className="mt-1 list-disc pl-5">
        {pending.map((claim) => (
          <li key={claim.id}>
            {claim.store.name}: enviado em {new Date(claim.createdAt).toLocaleDateString("pt-BR")}
          </li>
        ))}
      </ul>
    </Notice>
  );
}

export function MyStoresPanel() {
  const stores = useMyStores();
  return (
    <section aria-labelledby="my-stores" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="my-stores" className="text-3xl font-bold">
          Suas lojas
        </h2>
        <Link href="/merchant/onboarding" className="min-h-tap font-semibold text-brand underline underline-offset-4">
          Cadastrar outra loja
        </Link>
      </div>
      <PendingClaims />
      {stores.isPending && <Skeleton className="h-24 w-full" />}
      {stores.isError && <Notice tone="danger" title={errorMessage(stores.error)} />}
      <ul className="grid gap-3 md:grid-cols-2">
        {(stores.data ?? []).map((store) => (
          <li key={store.id} className="rounded-md border border-line bg-surface p-4">
            <Link
              href={`/merchant/stores/${store.id}`}
              className="text-lg font-semibold text-brand underline-offset-4 hover:underline"
            >
              {store.name}
            </Link>
            <p className="text-[0.9rem] text-ink-soft">{addressLine(store.address) ?? "Endereço não informado"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3">
              <VerificationNote status={store.verificationStatus} />
              {store.verificationStatus === "PENDING" && (
                <span className="text-[0.85rem] text-ink-soft">CNPJ em análise pela nossa equipe</span>
              )}
              <span className="text-[0.85rem] text-ink-soft">
                {store.memberRole === "OWNER" ? "Você é dono(a)" : "Você é da equipe"}
              </span>
            </div>
            <Link
              href={`/merchant/stores/${store.id}`}
              className="mt-3 inline-flex min-h-tap items-center rounded-full bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong"
            >
              Abrir painel da loja
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VerifyCnpj({ store }: { store: MyStore }) {
  const [cnpj, setCnpj] = useState("");
  const [error, setError] = useState<string>();
  const verify = useVerifyStore();
  return (
    <form
      noValidate
      className="mt-3 flex flex-col gap-2 border-t border-line pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValidCnpj(cnpj)) {
          setError("Esse CNPJ não é válido. Confira os números.");
          return;
        }
        setError(undefined);
        verify.mutate({ storeId: store.id, cnpj: normalizeCnpj(cnpj) });
      }}
    >
      <TextField
        label="Verificar com o CNPJ"
        inputMode="numeric"
        value={cnpj}
        error={error ?? (verify.isError ? errorMessage(verify.error) : undefined)}
        onChange={(event) => setCnpj(maskCnpj(event.target.value))}
      />
      {verify.data?.status === "PENDING" && (
        <p role="status" className="text-[0.9rem] text-ink-soft">
          CNPJ ativo, mas o endereço não bateu por completo. Nossa equipe vai conferir.
        </p>
      )}
      <Button type="submit" variant="secondary" loading={verify.isPending} className="self-start">
        Verificar loja
      </Button>
    </form>
  );
}
