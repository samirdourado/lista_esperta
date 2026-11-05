"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { MyReceipts } from "./MyReceipts";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import type { User } from "@/lib/api/types";
import { preferencesSchema, type PreferencesValues } from "@/lib/auth/schemas";
import { useSession, useSignOut, useUpdateProfile } from "@/lib/session";

const ROLE_LABEL: Record<User["role"], string> = { SHOPPER: "Cliente", MERCHANT: "Lojista", ADMIN: "Admin" };

const DENIED: Record<string, string> = {
  merchant: "Sua conta é de cliente. Para cadastrar uma loja, crie uma conta de lojista com outro e-mail.",
  admin: "Essa área é só para a equipe do Lista Esperta.",
};

export function AccountView() {
  const { data: user, isPending } = useSession();
  const params = useSearchParams();
  const denied = DENIED[params.get("denied") ?? ""];

  if (isPending) {
    return (
      <div aria-busy="true" className="mt-8 space-y-4">
        <p role="status" className="text-ink-soft">
          Carregando sua conta…
        </p>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (!user) return null; // proxy.ts already sent guests to /login

  return (
    <div className="mt-8 flex flex-col gap-8">
      {denied && <Notice tone="warning" title={denied} />}
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-soft">E-mail</dt>
        <dd className="font-medium break-all">{user.email}</dd>
        <dt className="text-ink-soft">Tipo de conta</dt>
        <dd className="font-medium">{ROLE_LABEL[user.role]}</dd>
      </dl>
      <PreferencesForm user={user} />
      <MyReceipts />
      <SignOut />
    </div>
  );
}

function PreferencesForm({ user }: { user: User }) {
  const update = useUpdateProfile();
  const form = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      displayName: user.displayName,
      costPerKm: user.costPerKm,
      valuePerHour: user.valuePerHour,
      defaultRadiusKm: user.defaultRadiusKm,
    },
  });
  const { errors, isSubmitting, isSubmitSuccessful, isDirty } = form.formState;
  const number = { valueAsNumber: true } as const;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync(values);
      form.reset({
        displayName: saved.displayName,
        costPerKm: saved.costPerKm,
        valuePerHour: saved.valuePerHour,
        defaultRadiusKm: saved.defaultRadiusKm,
      });
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <h2 className="text-2xl font-bold">Seus dados e o custo de ir até a loja</h2>
      {errors.root?.message && <Notice tone="danger" title={errors.root.message} />}
      {isSubmitSuccessful && !isDirty && !errors.root && <Notice tone="success" title="Alterações salvas." />}
      <TextField
        label="Nome"
        autoComplete="name"
        error={errors.displayName?.message}
        {...form.register("displayName")}
      />
      <TextField
        label="Custo por km (R$)"
        hint="Combustível e desgaste do carro. Usamos R$ 1,00 se você não mudar."
        type="number"
        inputMode="decimal"
        step="0.05"
        error={errors.costPerKm?.message}
        {...form.register("costPerKm", number)}
      />
      <TextField
        label="Quanto vale uma hora do seu tempo (R$)"
        hint="Deixe 0 para considerar só o dinheiro."
        type="number"
        inputMode="decimal"
        step="1"
        error={errors.valuePerHour?.message}
        {...form.register("valuePerHour", number)}
      />
      <TextField
        label="Distância padrão para buscar lojas (km)"
        type="number"
        inputMode="decimal"
        step="0.5"
        error={errors.defaultRadiusKm?.message}
        {...form.register("defaultRadiusKm", number)}
      />
      <Button type="submit" loading={isSubmitting} className="self-start">
        Salvar alterações
      </Button>
    </form>
  );
}

function SignOut() {
  const router = useRouter();
  const signOut = useSignOut();
  return (
    <div className="border-t border-line pt-6">
      <Button
        variant="secondary"
        loading={signOut.isPending}
        onClick={() => signOut.mutate(undefined, { onSettled: () => router.replace("/") })}
      >
        Sair da conta
      </Button>
      <p className="mt-2 text-[0.9rem] text-ink-soft">
        Suas listas continuam salvas na conta. Neste aparelho você volta a usar o app sem cadastro.
      </p>
    </div>
  );
}
