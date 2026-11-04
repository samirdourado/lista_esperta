"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { ListIcon, StoreIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { errorMessage } from "@/lib/api/errors";
import { registerSchema, type RegisterValues } from "@/lib/auth/schemas";
import { cx } from "@/lib/cx";
import { homeFor, safeNext, useSignUp } from "@/lib/session";

const CHOICES = [
  {
    value: "SHOPPER",
    title: "Quero economizar",
    text: "Salve suas listas, veja seu histórico de notas e acesse de qualquer aparelho.",
    Icon: ListIcon,
  },
  {
    value: "MERCHANT",
    title: "Tenho uma loja",
    text: "Cadastre sua loja, publique preços e ofertas e veja a procura na região.",
    Icon: StoreIcon,
  },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const signUp = useSignUp();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: params.get("type") === "merchant" ? "MERCHANT" : "SHOPPER",
      displayName: "",
      email: "",
      password: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const user = await signUp.mutateAsync(values);
      router.replace(safeNext(params.get("next")) ?? homeFor(user));
    } catch (error) {
      form.setError("root", {
        message: errorMessage(error, { 409: "Já existe uma conta com este e-mail. Entre com ela." }),
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-6">
      {errors.root?.message && (
        <Notice
          tone="danger"
          title={errors.root.message}
          action={
            <Link href="/login" className="font-semibold text-brand underline underline-offset-4">
              Ir para o login
            </Link>
          }
        />
      )}

      <fieldset>
        <legend className="font-medium">Como você vai usar o Lista Esperta?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {CHOICES.map(({ value, title, text, Icon }) => (
            <label
              key={value}
              className={cx(
                "flex cursor-pointer gap-3 rounded-md border-2 bg-surface p-4",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
                role === value ? "border-brand" : "border-line hover:border-line-strong",
              )}
            >
              <input type="radio" value={value} className="sr-only" {...form.register("role")} />
              <Icon width="1.75rem" height="1.75rem" className={role === value ? "text-brand" : "text-ink-soft"} />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-[0.9rem] text-ink-soft">{text}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.role?.message && <p className="mt-1.5 text-[0.9rem] font-medium text-danger">{errors.role.message}</p>}
      </fieldset>

      <TextField
        label={role === "MERCHANT" ? "Seu nome (responsável pela loja)" : "Seu nome"}
        autoComplete="name"
        error={errors.displayName?.message}
        {...form.register("displayName")}
      />
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
        autoComplete="new-password"
        hint="Pelo menos 8 caracteres."
        error={errors.password?.message}
        {...form.register("password")}
      />

      <Button type="submit" size="lg" block loading={isSubmitting}>
        {role === "MERCHANT" ? "Criar conta e cadastrar loja" : "Criar conta"}
      </Button>
      <p className="text-ink-soft">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-brand underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}
