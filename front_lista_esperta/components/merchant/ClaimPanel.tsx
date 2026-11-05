"use client";

import { useState } from "react";
import { StoreSummary } from "@/components/stores/StoreSummary";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { errorMessage } from "@/lib/api/errors";
import { isValidCnpj, maskCnpj, normalizeCnpj } from "@/lib/cnpj";
import { useClaimStore, type ClaimResult, type Store } from "@/lib/stores/queries";

/** "Esta é a minha loja": with a matching CNPJ it is approved right away. */
export function ClaimPanel({
  store,
  onDone,
  onBack,
}: {
  store: Store;
  onDone: (result: ClaimResult) => void;
  onBack: () => void;
}) {
  const [cnpj, setCnpj] = useState("");
  const [message, setMessage] = useState("");
  const [cnpjError, setCnpjError] = useState<string>();
  const claim = useClaimStore();

  const submit = async () => {
    if (cnpj && !isValidCnpj(cnpj)) {
      setCnpjError("Esse CNPJ não é válido. Confira os números.");
      return;
    }
    setCnpjError(undefined);
    onDone(
      await claim.mutateAsync({
        storeId: store.id,
        ...(cnpj ? { cnpj: normalizeCnpj(cnpj) } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      }),
    );
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit().catch(() => undefined);
      }}
      className="flex flex-col gap-5"
    >
      <div className="rounded-md border border-line bg-surface p-4">
        <StoreSummary store={store} />
      </div>
      {claim.isError && <Notice tone="danger" title={errorMessage(claim.error)} />}
      <TextField
        label="CNPJ da loja"
        hint="Se o CNPJ bater com o endereço na Receita Federal, você passa a administrar a loja na hora."
        inputMode="numeric"
        value={cnpj}
        error={cnpjError}
        onChange={(event) => setCnpj(maskCnpj(event.target.value))}
      />
      <TextAreaField
        label="Algo mais que ajude a confirmar (opcional)"
        hint="Sem CNPJ, nossa equipe confere o pedido antes de liberar."
        rows={3}
        maxLength={500}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={claim.isPending}>
          Pedir para administrar
        </Button>
        <Button variant="ghost" size="lg" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
