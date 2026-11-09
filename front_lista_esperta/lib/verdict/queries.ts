"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { getGuestId } from "@/lib/device/device-store";
import type { Point } from "@/lib/location/use-location";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";

type Schemas = components["schemas"];
export type Verdict = Schemas["VerdictResponseDto"];
export type RankedStore = Schemas["RankedStoreDto"];
export type VerdictStore = Schemas["VerdictStoreDto"];
export type PriceEvidence = Schemas["PriceEvidenceDto"];

export interface VerdictInput {
  origin: Point;
  items: ShoppingListItem[];
  radiusKm: number;
}

/** POST /verdict is stateless: the same input always means the same answer. */
export function useVerdict(input: VerdictInput | null) {
  return useQuery({
    queryKey: ["verdict", input],
    enabled: Boolean(input && input.items.length > 0),
    queryFn: async () => {
      const body = {
        origin: input!.origin,
        radiusKm: input!.radiusKm,
        items: input!.items.map((item) => ({
          text: item.freeText,
          quantity: item.quantity,
          ...(item.productId ? { productId: item.productId } : {}),
          ...(item.webPrice?.ean ? { ean: item.webPrice.ean } : {}),
        })),
      };
      return unwrap(await api.POST("/api/v1/verdict", { body, headers: { "X-Guest-Id": await getGuestId() } }));
    },
    // Shops in a new area import in the background: ask again while they do.
    refetchInterval: (query) =>
      (query.state.data?.params.pendingAreas ?? 0) + (query.state.data?.params.addressesPending ?? 0) > 0 &&
      query.state.dataUpdateCount < 12
        ? 10_000
        : false,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
}

export function useParseListPhoto() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return unwrap(
        await api.POST("/api/v1/lists/parse-photo", {
          body: form as never,
          bodySerializer: (body) => body as unknown as FormData,
        }),
      );
    },
  });
}

/** "visto há 2 h · 3 notas fiscais" (spec section 5). */
export function evidenceLabel(evidence: PriceEvidence, now = Date.now()): string {
  const minutes = Math.max(1, Math.round((now - new Date(evidence.observedAt).getTime()) / 60_000));
  const ago =
    minutes < 60
      ? `${minutes} min`
      : minutes < 48 * 60
        ? `${Math.round(minutes / 60)} h`
        : `${Math.round(minutes / (24 * 60))} dias`;
  const receipts = evidence.receiptCount === 1 ? "1 nota fiscal" : `${evidence.receiptCount} notas fiscais`;
  switch (evidence.source) {
    case "NFCE":
      return `visto há ${ago} · ${receipts}`;
    case "MERCHANT":
      return evidence.offer ? "Oferta informada pela loja" : "Preço informado pela loja";
    case "PRECOMELHOR":
      return `PreçoMelhor · há ${ago}`;
    case "FLYER":
      return `Encarte da loja · há ${ago}`;
    default:
      return `Informado por clientes · há ${ago}`;
  }
}
