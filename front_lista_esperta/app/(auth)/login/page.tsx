import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <>
      <PageHeading
        title="Entrar"
        lead="Para lojistas, para a equipe e para quem quer as listas em todos os aparelhos."
      />
      <Suspense fallback={<p className="mt-8 text-ink-soft">Carregando…</p>}>
        <LoginForm />
      </Suspense>
    </>
  );
}
