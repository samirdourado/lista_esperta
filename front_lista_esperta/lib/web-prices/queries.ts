"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ApiError, unwrap } from "@/lib/api/errors";
import type { WebOffer } from "@/lib/api/types";
import type { Point } from "@/lib/location/use-location";

export type { WebOffer };

const ERROR: Record<string, string> = {
  WEB_SEARCH_UNAVAILABLE: "A busca de preços na internet não está disponível agora.",
  WEB_SEARCH_QUOTA: "A busca na internet atingiu o limite deste mês. Use as sugestões do catálogo.",
  WEB_SEARCH_FAILED: "A busca na internet não respondeu. Tente de novo em instantes.",
};

export function webSearchError(error: unknown): string {
  if (error instanceof ApiError && error.code && ERROR[error.code]) return ERROR[error.code];
  if (error instanceof ApiError && error.status === 429)
    return "Muitas buscas seguidas. Espere um pouco e tente de novo.";
  return "Não conseguimos buscar os preços agora.";
}

/** Cheapest offers on Google Shopping in the person's city (GET /web-prices). */
export function useWebPriceSearch() {
  return useMutation({
    mutationFn: async ({ query, point }: { query: string; point?: Point }) =>
      unwrap(
        await api.GET("/api/v1/web-prices", {
          params: { query: { q: query, ...(point ? { lat: point.lat, lng: point.lng } : {}) } },
        }),
      ),
  });
}
