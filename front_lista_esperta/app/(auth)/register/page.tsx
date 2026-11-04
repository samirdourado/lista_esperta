import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <>
      <PageHeading
        title="Criar conta"
        lead="Para comparar preços você não precisa de conta. Ela serve para guardar suas listas ou para cadastrar sua loja."
      />
      <Suspense fallback={<p className="mt-8 text-ink-soft">Carregando…</p>}>
        <RegisterForm />
      </Suspense>
    </>
  );
}
