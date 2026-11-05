"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { getGuestId } from "@/lib/device/device-store";
import { useSession } from "@/lib/session";

type Schemas = components["schemas"];
export type ReceiptResult = Schemas["ReceiptResultDto"];
export type AccessKeyInfo = Schemas["AccessKeyInfoDto"];

/** Public writes carry the device id (rate limit and anonymous attribution, spec section 3). */
async function guestHeader() {
  return { "X-Guest-Id": await getGuestId() };
}

export function useImportQr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) =>
      unwrap(await api.POST("/api/v1/receipts/qr", { body: { url }, headers: await guestHeader() })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["receipts"] }),
  });
}

export function useImportPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return unwrap(
        await api.POST("/api/v1/receipts/photo", {
          body: form as never,
          bodySerializer: (body) => body as unknown as FormData,
          headers: await guestHeader(),
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["receipts"] }),
  });
}

export function useKeyInfo() {
  return useMutation({
    mutationFn: async (accessKey: string) => unwrap(await api.POST("/api/v1/receipts/key", { body: { accessKey } })),
  });
}

/** Receipt history, only for signed-in shoppers. */
export function useMyReceipts() {
  const { data: user } = useSession();
  return useQuery({
    queryKey: ["receipts", "mine"],
    enabled: Boolean(user),
    queryFn: async () => unwrap(await api.GET("/api/v1/receipts/mine")),
  });
}

/** Messages for the API error codes of the receipt routes. */
export const RECEIPT_ERROR: Record<string, string> = {
  NOT_A_RECEIPT_QR: "Esse QR Code não é de uma nota fiscal de consumidor (NFC-e).",
  UF_NOT_SUPPORTED: "Por enquanto lemos notas de São Paulo. Envie uma foto da nota que guardamos a chave.",
  RECEIPT_UNREADABLE: "A SEFAZ não mostrou essa nota agora. Tente de novo mais tarde ou envie uma foto.",
  RECEIPT_MISMATCH: "A página da SEFAZ não corresponde a esta nota.",
  RECEIPT_ALREADY_SENT: "Essa nota já foi enviada. Obrigado mesmo assim!",
  SEFAZ_UNAVAILABLE: "A SEFAZ não respondeu agora. Tente de novo em alguns minutos.",
  STORE_NOT_LOCATED: "Não conseguimos achar o endereço da loja no mapa.",
  PHOTO_UNAVAILABLE: "A leitura de fotos não está disponível agora. Use o QR Code.",
  PHOTO_SERVICE_UNAVAILABLE: "A leitura de fotos não respondeu agora. Tente de novo em instantes.",
  PHOTO_UNREADABLE: "Não conseguimos ler essa foto. Tente com mais luz, a nota inteira e sem dobras.",
  PHOTO_KEY_UNREADABLE:
    "Não conseguimos ler a chave de acesso (44 números) na foto. Fotografe a parte de baixo da nota.",
};
