"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { refreshSession } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { loginSchema, type LoginValues } from "@/lib/auth/schemas";
import { homeFor, safeNext, SESSION_KEY, useSignIn } from "@/lib/session";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const queryClient = useQueryClient();
  const signIn = useSignIn();
  // Coming from a protected page: the access cookie may just have expired.
  const [checking, setChecking] = useState(Boolean(next) && params.get("error") !== "unavailable");

  useEffect(() => {
    if (!checking || !next) return;
    let cancelled = false;
    void refreshSession().then(async (renewed) => {
      if (cancelled) return;
      if (renewed) {
        await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
        router.replace(next);
      } else {
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [checking, next, queryClient, router]);

  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const user = await signIn.mutateAsync(values);
      router.replace(next ?? homeFor(user));
    } catch (error) {
      form.setError("root", { message: errorMessage(error, { 401: "E-mail ou senha incorretos." }) });
    }
  });

  if (checking) {
    return (
      <p role="status" className="mt-8 text-ink-soft">
        Verificando sua sessão…
      </p>
    );
  }

  const merchantFlow = next?.startsWith("/merchant");
  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
      {params.get("error") === "unavailable" && (
        <Notice tone="warning" title="Não conseguimos confirmar sua sessão">
          O servidor não respondeu. Entre de novo ou tente em instantes.
        </Notice>
      )}
      {errors.root?.message && <Notice tone="danger" title={errors.root.message} />}
      <TextField
        label="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...form.register("email")}
      />
      <TextField
        label="Senha"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...form.register("password")}
      />
      <Button type="submit" size="lg" block loading={isSubmitting}>
        Entrar
      </Button>
      <p className="text-ink-soft">
        {merchantFlow ? "Ainda não cadastrou sua loja? " : "Ainda não tem conta? "}
        <Link
          href={merchantFlow ? "/register?type=merchant" : "/register"}
          className="font-semibold text-brand underline underline-offset-4"
        >
          {merchantFlow ? "Criar conta de lojista" : "Criar conta"}
        </Link>
      </p>
    </form>
  );
}
