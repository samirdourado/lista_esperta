"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ApiError, unwrap } from "@/lib/api/errors";
import type { WebOffer, WebPriceResult } from "@/lib/api/types";
import { productPrices, searchProducts } from "@/lib/directory/client";
import { distanceKm, pickCandidates } from "@/lib/directory/match";
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

const SHOWN = 6;
const NEAR_KM = 10;

/**
 * Products from PreçoMelhor, read in the browser (D-079): photo, name,
 * barcode and the cheapest price nearby (or the usual one in the country).
 * Sold near the person first. Empty when nothing matches.
 */
export async function searchDirectoryOffers(query: string, point?: Point): Promise<WebOffer[]> {
  const products = pickCandidates(query, await searchProducts(query), SHOWN);
  const offers = await Promise.all(
    products.map(async (product): Promise<WebOffer | null> => {
      const details = await productPrices(product.ean, null).catch(() => null);
      if (!details || details.prices.length === 0) return null;
      const near = point ? details.prices.filter((row) => distanceKm(point, row) <= NEAR_KM) : [];
      const usual = details.nationalMedian ?? details.prices[0].price;
      // A price far from the country's median is a data error.
      const nearPrices = near.map((row) => row.price).filter((price) => price >= usual / 2.5 && price <= usual * 2.5);
      return {
        title: product.name,
        price: nearPrices.length > 0 ? Math.min(...nearPrices) : usual,
        store: "PreçoMelhor",
        thumbnail: product.imageUrl,
        url: null,
        delivery: null,
        nearby: nearPrices.length > 0 ? "Perto de você" : null,
        ean: product.ean,
      };
    }),
  );
  return offers
    .filter((offer): offer is WebOffer => offer !== null)
    .sort((a, b) => Number(b.nearby !== null) - Number(a.nearby !== null) || a.price - b.price);
}

/** PreçoMelhor first (from the browser); Google through our API when it finds nothing. */
export function useWebPriceSearch() {
  return useMutation({
    mutationFn: async ({ query, point }: { query: string; point?: Point }): Promise<WebPriceResult> => {
      const offers = await searchDirectoryOffers(query, point).catch(() => []);
      if (offers.length > 0) {
        return {
          query,
          location: point ? "perto de você" : null,
          offers,
          searchedAt: new Date().toISOString(),
          source: "PRECOMELHOR",
        };
      }
      return unwrap(
        await api.GET("/api/v1/web-prices", {
          params: { query: { q: query, ...(point ? { lat: point.lat, lng: point.lng } : {}) } },
        }),
      );
    },
  });
}
