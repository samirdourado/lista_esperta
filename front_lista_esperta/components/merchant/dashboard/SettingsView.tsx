"use client";

import { useRef } from "react";
import { addressLine } from "@/components/stores/StoreSummary";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { errorMessage } from "@/lib/api/errors";
import { useDeletePhoto, useStorePhotos, useUploadPhoto } from "@/lib/merchant/queries";
import { useMyStores } from "@/lib/stores/queries";
import { VerifyCnpj } from "../MyStoresPanel";
import { useIsOwner, useStoreId } from "./StoreShell";

export function SettingsView() {
  const storeId = useStoreId();
  const owner = useIsOwner(storeId);
  const store = useMyStores().data?.find((s) => s.id === storeId);
  const photos = useStorePhotos(storeId);
  const upload = useUploadPhoto(storeId);
  const remove = useDeletePhoto(storeId);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section aria-labelledby="store-data">
        <h2 id="store-data" className="text-2xl font-bold">
          Dados da loja
        </h2>
        <p className="mt-1 text-ink-soft">{addressLine(store?.address ?? null) ?? "Endereço não informado"}</p>
        {store?.cnpj && (
          <p className="text-ink-soft">
            CNPJ {store.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
          </p>
        )}
        {store && owner && store.verificationStatus === "UNVERIFIED" && <VerifyCnpj store={store} />}
        {store?.verificationStatus === "PENDING" && (
          <Notice tone="info" title="CNPJ em análise" className="mt-3">
            O endereço não bateu por completo com o da Receita Federal. Nossa equipe confere e libera o selo.
          </Notice>
        )}
      </section>

      <section aria-labelledby="store-photos">
        <h2 id="store-photos" className="text-2xl font-bold">
          Fotos
        </h2>
        <p className="mt-1 text-ink-soft">
          Fachada e interior ajudam o cliente a reconhecer a loja. JPEG, PNG ou WebP, até 5 MB, até 10 fotos.
        </p>
        {(upload.isError || remove.isError) && (
          <Notice tone="danger" title={errorMessage(upload.error ?? remove.error)} className="mt-3" />
        )}
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(photos.data ?? []).map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-md border border-line bg-surface">
              {/* Uploaded by the merchant; served by the API with a random name. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`Foto ${index + 1} da loja`} className="aspect-[4/3] w-full object-cover" />
              <button
                type="button"
                className="block min-h-tap w-full text-[0.95rem] font-medium text-ink-soft hover:bg-surface-sunken hover:text-danger"
                onClick={() => remove.mutate(photo.id)}
              >
                Remover foto
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) upload.mutate(file);
          }}
        />
        <Button variant="secondary" className="mt-4" loading={upload.isPending} onClick={() => input.current?.click()}>
          Enviar foto
        </Button>
      </section>
    </div>
  );
}
