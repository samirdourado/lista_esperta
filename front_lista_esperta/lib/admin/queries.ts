"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];
export type AdminOverview = Schemas["AdminOverviewDto"];
export type AdminClaim = Schemas["AdminStoreClaimResponseDto"];
export type PendingStore = Schemas["PendingStoreDto"];
export type PendingAlias = Schemas["PendingAliasDto"];
export type AdminProduct = Schemas["AdminProductDto"];
export type DuplicatePair = Schemas["DuplicatePairDto"];

const KEY = ["admin"] as const;

/** Every admin decision can change the counters and the lists: refresh them all. */
function useRefreshAdmin() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: [...KEY, "overview"],
    queryFn: async () => unwrap(await api.GET("/api/v1/admin/overview")),
  });
}

export function usePendingClaims() {
  return useQuery({
    queryKey: [...KEY, "claims"],
    queryFn: async () => unwrap(await api.GET("/api/v1/admin/store-claims")),
  });
}

export function useDecideClaim() {
  const refresh = useRefreshAdmin();
  return useMutation({
    mutationFn: async ({ claimId, approve }: { claimId: string; approve: boolean }) => {
      const params = { params: { path: { claimId } } };
      return unwrap(
        approve
          ? await api.POST("/api/v1/admin/store-claims/{claimId}/approve", params)
          : await api.POST("/api/v1/admin/store-claims/{claimId}/reject", params),
      );
    },
    onSuccess: refresh,
  });
}

export function usePendingStores() {
  return useQuery({
    queryKey: [...KEY, "stores"],
    queryFn: async () => unwrap(await api.GET("/api/v1/admin/stores/pending-verification")),
  });
}

export function useSetVerification() {
  const refresh = useRefreshAdmin();
  return useMutation({
    mutationFn: async ({ storeId, status }: { storeId: string; status: "VERIFIED" | "UNVERIFIED" }) =>
      unwrap(
        await api.POST("/api/v1/admin/stores/{storeId}/verification", {
          params: { path: { storeId } },
          body: { status },
        }),
      ),
    onSuccess: refresh,
  });
}

export function usePendingAliases() {
  return useQuery({
    queryKey: [...KEY, "aliases"],
    queryFn: async () => unwrap(await api.GET("/api/v1/admin/aliases/pending")),
  });
}

export function useDecideAlias() {
  const refresh = useRefreshAdmin();
  return useMutation({
    mutationFn: async ({ aliasId, approve, productId }: { aliasId: string; approve: boolean; productId?: string }) => {
      const path = { path: { aliasId } };
      return unwrap(
        approve
          ? await api.POST("/api/v1/admin/aliases/{aliasId}/approve", {
              params: path,
              body: productId ? { productId } : {},
            })
          : await api.POST("/api/v1/admin/aliases/{aliasId}/reject", { params: path }),
      );
    },
    onSuccess: refresh,
  });
}

export function useDuplicates() {
  return useQuery({
    queryKey: [...KEY, "duplicates"],
    queryFn: async () => unwrap(await api.GET("/api/v1/admin/products/duplicates")),
  });
}

export function useMergeProducts() {
  const refresh = useRefreshAdmin();
  return useMutation({
    mutationFn: async (body: { keepId: string; mergeId: string }) =>
      unwrap(await api.POST("/api/v1/admin/products/merge", { body })),
    onSuccess: refresh,
  });
}
