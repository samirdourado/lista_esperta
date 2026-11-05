"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];
export type PriceAlert = Schemas["PriceAlertDto"];
export type CreateAlertBody = Schemas["CreateAlertDto"];
export type UpdateAlertBody = Schemas["UpdateAlertDto"];

const KEY = ["alerts"] as const;

export function useAlerts(enabled: boolean) {
  return useQuery({
    queryKey: KEY,
    enabled,
    queryFn: async () => unwrap(await api.GET("/api/v1/alerts")),
  });
}

function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}

export function useCreateAlert() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (body: CreateAlertBody) => unwrap(await api.POST("/api/v1/alerts", { body })),
    onSuccess: refresh,
  });
}

export function useUpdateAlert() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateAlertBody & { id: string }) =>
      unwrap(await api.PATCH("/api/v1/alerts/{id}", { params: { path: { id } }, body })),
    onSuccess: refresh,
  });
}

export function useDeleteAlert() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.DELETE("/api/v1/alerts/{id}", { params: { path: { id } } })),
    onSuccess: refresh,
  });
}
