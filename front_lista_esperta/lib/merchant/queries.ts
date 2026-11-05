"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];
export type CatalogItem = Schemas["CatalogItemDto"];
export type StoreOverview = Schemas["StoreOverviewDto"];
export type ImportReport = Schemas["ImportReportDto"];
export type Product = Schemas["ProductResponseDto"];
export type ProductLookup = Schemas["ProductLookupResponseDto"];
export type CreateProductBody = Schemas["CreateProductDto"];
export type PriceInput = Schemas["PriceInputDto"];
export type StoreMember = Schemas["StoreMemberResponseDto"];
export type StorePhoto = Schemas["StorePhotoDto"];
export type MeasureUnit = Product["unit"];

const path = (storeId: string) => ({ params: { path: { storeId } } });
const key = (storeId: string, ...rest: unknown[]) => ["merchant", storeId, ...rest];

export function useStoreOverview(storeId: string) {
  return useQuery({
    queryKey: key(storeId, "overview"),
    queryFn: async () => unwrap(await api.GET("/api/v1/stores/{storeId}/overview", path(storeId))),
  });
}

export function useStoreCatalog(storeId: string, q: string) {
  return useQuery({
    queryKey: key(storeId, "catalog", q),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/stores/{storeId}/products", {
          params: { path: { storeId }, query: q ? { q } : {} },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

function useInvalidateStore(storeId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: key(storeId) });
}

export function useSetPrices(storeId: string) {
  const invalidate = useInvalidateStore(storeId);
  return useMutation({
    mutationFn: async (prices: PriceInput[]) =>
      unwrap(await api.PUT("/api/v1/stores/{storeId}/prices", { ...path(storeId), body: { prices } })),
    onSuccess: invalidate,
  });
}

export function useWithdrawProduct(storeId: string) {
  const invalidate = useInvalidateStore(storeId);
  return useMutation({
    mutationFn: async (productId: string) =>
      unwrap(
        await api.DELETE("/api/v1/stores/{storeId}/products/{productId}", {
          params: { path: { storeId, productId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useEndOffer(storeId: string) {
  const invalidate = useInvalidateStore(storeId);
  return useMutation({
    mutationFn: async (offerId: string) =>
      unwrap(
        await api.DELETE("/api/v1/stores/{storeId}/offers/{offerId}", {
          params: { path: { storeId, offerId } },
        }),
      ),
    onSuccess: invalidate,
  });
}

/** multipart/form-data: openapi-fetch serializes the FormData as is. */
function formWith(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

export function useImportCsv(storeId: string) {
  const invalidate = useInvalidateStore(storeId);
  return useMutation({
    mutationFn: async (file: File) =>
      unwrap(
        await api.POST("/api/v1/stores/{storeId}/prices/import", {
          ...path(storeId),
          body: formWith(file) as never,
          bodySerializer: (body) => body as unknown as FormData,
        }),
      ) as ImportReport,
    onSuccess: invalidate,
  });
}

export function useProductSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["products", "search", query.toLowerCase()],
    enabled: query.length >= 2,
    queryFn: async () => unwrap(await api.GET("/api/v1/products", { params: { query: { q: query, limit: 8 } } })),
    placeholderData: (previous) => previous,
  });
}

export function useGtinLookup() {
  return useMutation({
    mutationFn: async (gtin: string) =>
      unwrap(await api.GET("/api/v1/products/lookup/{gtin}", { params: { path: { gtin } } })),
  });
}

export function useCreateProduct() {
  return useMutation({
    mutationFn: async (body: CreateProductBody) => unwrap(await api.POST("/api/v1/products", { body })),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => unwrap(await api.GET("/api/v1/categories")),
    staleTime: 60 * 60_000,
  });
}

export function useStoreMembers(storeId: string) {
  return useQuery({
    queryKey: key(storeId, "members"),
    queryFn: async () => unwrap(await api.GET("/api/v1/stores/{storeId}/members", path(storeId))),
  });
}

export function useAddMember(storeId: string) {
  const invalidate = useInvalidateStore(storeId);
  return useMutation({
    mutationFn: async (email: string) =>
      unwrap(await api.POST("/api/v1/stores/{storeId}/members", { ...path(storeId), body: { email } })),
    onSuccess: invalidate,
  });
}

export function useRemoveMember(storeId: string) {
  const invalidate = useInvalidateStore(storeId);
  return useMutation({
    mutationFn: async (userId: string) =>
      unwrap(await api.DELETE("/api/v1/stores/{storeId}/members/{userId}", { params: { path: { storeId, userId } } })),
    onSuccess: invalidate,
  });
}

export function useStorePhotos(storeId: string) {
  return useQuery({
    queryKey: key(storeId, "photos"),
    queryFn: async () => unwrap(await api.GET("/api/v1/stores/{storeId}/photos", path(storeId))),
  });
}

export function useUploadPhoto(storeId: string) {
  const invalidate = useInvalidateStore(storeId);
  return useMutation({
    mutationFn: async (file: File) =>
      unwrap(
        await api.POST("/api/v1/stores/{storeId}/photos", {
          ...path(storeId),
          body: formWith(file) as never,
          bodySerializer: (body) => body as unknown as FormData,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useDeletePhoto(storeId: string) {
  const invalidate = useInvalidateStore(storeId);
  return useMutation({
    mutationFn: async (photoId: string) =>
      unwrap(await api.DELETE("/api/v1/stores/{storeId}/photos/{photoId}", { params: { path: { storeId, photoId } } })),
    onSuccess: invalidate,
  });
}

export type FlyerImport = Schemas["FlyerImportDto"];

export function useFlyers(storeId: string) {
  return useQuery({
    queryKey: key(storeId, "flyers"),
    queryFn: async () => unwrap(await api.GET("/api/v1/stores/{storeId}/flyers", path(storeId))),
  });
}

/** Firecrawl + Gemini read the link; takes from a few seconds to a minute. */
export function useImportFlyer(storeId: string) {
  const invalidate = useInvalidateStore(storeId);
  return useMutation({
    mutationFn: async (url: string) =>
      unwrap(await api.POST("/api/v1/stores/{storeId}/flyers", { ...path(storeId), body: { url } })),
    // Failed attempts are listed too.
    onSettled: invalidate,
  });
}
