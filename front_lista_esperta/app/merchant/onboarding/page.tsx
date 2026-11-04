import type { Metadata } from "next";
import { PageHeading } from "@/components/ui/PageHeading";

export const metadata: Metadata = { title: "Cadastrar loja" };

const STEPS = [
  {
    title: "Encontre ou cadastre sua loja",
    text: "Se ela já aparece no mapa, você pede para administrá-la. Se não aparece, você cadastra com endereço e pin no mapa.",
  },
  { title: "Confirme o CNPJ", text: "Conferimos a razão social e o endereço na Receita Federal." },
  { title: "Publique preços e ofertas", text: "Um a um, por código de barras ou por planilha." },
];

/** Merchants without a store land here (proxy.ts). The store form arrives in phase 4. */
export default function MerchantOnboardingPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-8">
      <PageHeading
        title="Vamos cadastrar sua loja"
        lead="Sua conta de lojista está pronta. Faltam três passos para sua loja aparecer nas comparações."
      />
      <ol className="mt-8 flex flex-col gap-5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-lg font-bold text-brand"
            >
              {index + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="text-ink-soft">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-10 rounded-md bg-surface-sunken px-4 py-3 text-[0.95rem] text-ink-soft">
        O cadastro da loja ainda está em construção nesta versão.
      </p>
    </div>
  );
}
