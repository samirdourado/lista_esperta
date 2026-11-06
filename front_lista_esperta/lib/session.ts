"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { ApiError, unwrap } from "@/lib/api/errors";
import type { SignUpRole, User } from "@/lib/api/types";
import { LocalShoppingListRepository } from "@/lib/shopping-lists/local";
import { migrateGuestDataToAccount } from "@/lib/shopping-lists/migrate";
import { RemoteShoppingListRepository } from "@/lib/shopping-lists/remote";
import type { ShoppingListRepository } from "@/lib/shopping-lists/repository";

export const SESSION_KEY = ["session"] as const;

async function fetchSession(): Promise<User | null> {
  try {
    return unwrap(await api.GET("/api/v1/auth/me"));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** The signed-in user, `null` for guests, `undefined` while loading. */
export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: 5 * 60_000, retry: false });
}

/** Device storage for guests, the API for signed-in users. */
export function useShoppingListRepository(): ShoppingListRepository {
  const { data: user } = useSession();
  const signedIn = Boolean(user);
  return useMemo(() => (signedIn ? new RemoteShoppingListRepository() : new LocalShoppingListRepository()), [signedIn]);
}

/** Where to land after signing in, unless the person was heading somewhere. */
export function homeFor(user: User): string {
  if (user.role === "MERCHANT") return user.storeIds.length > 0 ? "/merchant" : "/merchant/onboarding";
  return "/";
}

/** Accepts only same-site paths, so `?next=` cannot send people to another site. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

function useAfterAuth() {
  const queryClient = useQueryClient();
  return async (user: User) => {
    queryClient.setQueryData(SESSION_KEY, user);
    try {
      await migrateGuestDataToAccount();
    } catch {
      // Local lists stay on the device and are sent again on the next sign-in.
    }
    await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
    return user;
  };
}

export function useSignIn() {
  const afterAuth = useAfterAuth();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) =>
      afterAuth(unwrap(await api.POST("/api/v1/auth/login", { body })).user),
  });
}

export function useSignUp() {
  const afterAuth = useAfterAuth();
  return useMutation({
    mutationFn: async (body: { email: string; password: string; displayName: string; role: SignUpRole }) =>
      afterAuth(unwrap(await api.POST("/api/v1/auth/register", { body })).user),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      unwrap(await api.POST("/api/v1/auth/logout"));
    },
    onSettled: () => {
      queryClient.setQueryData(SESSION_KEY, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      displayName?: string;
      defaultRadiusKm?: number;
    }) => unwrap(await api.PATCH("/api/v1/users/me", { body })),
    onSuccess: (user) => queryClient.setQueryData(SESSION_KEY, user),
  });
}
