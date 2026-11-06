"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import type { Point } from "@/lib/location/use-location";
import { SESSION_KEY } from "@/lib/session";

type Schemas = components["schemas"];
export type Store = Schemas["StoreResponseDto"];
export type MyStore = Schemas["MyStoreResponseDto"];
export type StoreClaim = Schemas["StoreClaimResponseDto"];
export type GeocodedPlace = Schemas["GeocodedPlaceDto"];
export type StoreAddress = Schemas["AddressDto"];
export type CreateStoreBody = Schemas["CreateStoreDto"];
export type CreateStoreResult = Schemas["CreateStoreResponseDto"];
export type ClaimResult = Schemas["CreateStoreClaimResponseDto"];

/** Keeps the cache key stable while the GPS jitters by a few metres. */
const round = (value: number) => Math.round(value * 1000) / 1000;

export function useAddressSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["geocoding", q.toLowerCase()],
    enabled: q.length >= 3,
    queryFn: async () => unwrap(await api.GET("/api/v1/geocoding/search", { params: { query: { q } } })),
    staleTime: 60 * 60_000,
  });
}

/** The address at a point, so the person can check where the app thinks they are. */
export function usePlaceName(point: Point | undefined) {
  const lat = point ? Number(point.lat.toFixed(4)) : null;
  const lng = point ? Number(point.lng.toFixed(4)) : null;
  return useQuery({
    queryKey: ["geocoding", "reverse", lat, lng],
    enabled: lat !== null && lng !== null,
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/geocoding/reverse", { params: { query: { lat: lat!, lng: lng! } } })),
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
}

export function useClaimableStores(point: Point | undefined, name: string) {
  const q = name.trim();
  return useQuery({
    queryKey: ["stores", "claimable", point && round(point.lat), point && round(point.lng), q.toLowerCase()],
    enabled: Boolean(point),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/stores/claimable", {
          params: { query: { lat: point!.lat, lng: point!.lng, ...(q.length >= 2 ? { q } : {}) } },
        }),
      ),
  });
}

export function useMyStores() {
  return useQuery({
    queryKey: ["stores", "mine"],
    queryFn: async () => unwrap(await api.GET("/api/v1/stores/mine")),
  });
}

export function useMyClaims() {
  return useQuery({
    queryKey: ["store-claims", "mine"],
    queryFn: async () => unwrap(await api.GET("/api/v1/store-claims/mine")),
  });
}

function useInvalidateMerchant() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stores"] }),
      queryClient.invalidateQueries({ queryKey: ["store-claims"] }),
      queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
    ]);
}

export function useCreateStore() {
  const invalidate = useInvalidateMerchant();
  return useMutation({
    mutationFn: async (body: CreateStoreBody) => unwrap(await api.POST("/api/v1/stores", { body })),
    onSuccess: invalidate,
  });
}

export function useClaimStore() {
  const invalidate = useInvalidateMerchant();
  return useMutation({
    mutationFn: async (body: { storeId: string; cnpj?: string; message?: string }) =>
      unwrap(await api.POST("/api/v1/store-claims", { body })),
    onSuccess: invalidate,
  });
}

export function useVerifyStore() {
  const invalidate = useInvalidateMerchant();
  return useMutation({
    mutationFn: async ({ storeId, cnpj }: { storeId: string; cnpj: string }) =>
      unwrap(
        await api.POST("/api/v1/stores/{storeId}/verification", {
          params: { path: { storeId } },
          body: { cnpj },
        }),
      ),
    onSuccess: invalidate,
  });
}
