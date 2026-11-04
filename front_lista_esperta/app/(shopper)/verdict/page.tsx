import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { VerdictView } from "@/components/verdict/VerdictView";
import { selectSponsored } from "@/lib/ads/select";
import { pickTip } from "@/lib/forecast/heuristic";
import { fromSearchParams } from "@/lib/list/query";
import { buildVerdict } from "@/lib/verdict/build";

export const metadata: Metadata = { title: "Veredito" };

export default function VerdictPage({ searchParams }: PageProps<"/verdict">) {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-20">
      <Suspense fallback={<VerdictSkeleton />}>
        <VerdictContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function VerdictContent({ searchParams }: { searchParams: PageProps<"/verdict">["searchParams"] }) {
  const query = fromSearchParams(await searchParams);
  if (!query) {
    return (
      <div className="pt-10">
        <h1 className="font-display text-4xl font-bold">Falta a lista</h1>
        <p className="mt-2 text-ink-soft">
          Este link não tem itens. Escreva ou fotografe sua lista para ver o veredito.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-on-brand hover:bg-brand-strong"
        >
          Escrever minha lista
        </Link>
      </div>
    );
  }

  // Ordem importa: o veredito (e seu hash) existe antes de qualquer anúncio ser escolhido.
  const verdict = buildVerdict(query);
  const sponsored = query.ads ? selectSponsored(verdict, query.lines) : [];
  const tip = pickTip(verdict.primary, new Date());

  return <VerdictView verdict={verdict} query={query} sponsored={sponsored} tip={tip} />;
}

function VerdictSkeleton() {
  return (
    <div aria-busy="true" className="pt-4">
      <p className="text-ink-soft" role="status">
        Comparando sua lista nos mercados por perto…
      </p>
      <div className="skeleton-pulse mt-6 space-y-3">
        <div className="h-12 w-3/4 rounded bg-muted-soft" />
        <div className="h-12 w-1/2 rounded bg-muted-soft" />
        <div className="mt-6 h-28 w-64 rounded bg-muted-soft" />
        <div className="mt-8 h-14 w-full rounded-full bg-muted-soft" />
      </div>
    </div>
  );
}
