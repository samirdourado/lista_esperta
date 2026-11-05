"use client";

import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage } from "@/lib/api/errors";
import { brl } from "@/lib/format";
import { useStoreOverview } from "@/lib/merchant/queries";
import { useStoreId } from "./StoreShell";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="border-t-2 border-line pt-3">
      <p className="font-display text-4xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p>
      <p className="text-[0.95rem] text-ink-soft">{label}</p>
    </div>
  );
}

const pct = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)} %`;

export function OverviewView() {
  const storeId = useStoreId();
  const overview = useStoreOverview(storeId);

  if (overview.isPending) return <Skeleton className="h-40 w-full" />;
  if (overview.isError) return <Notice tone="danger" title={errorMessage(overview.error)} />;
  const data = overview.data;

  if (data.productsListed === 0) {
    return (
      <Notice
        tone="info"
        title="Sua loja ainda não tem preços"
        action={
          <div className="flex flex-wrap gap-x-4">
            <Link
              href={`/merchant/stores/${storeId}/products`}
              className="font-semibold text-brand underline underline-offset-4"
            >
              Adicionar produtos
            </Link>
            <Link
              href={`/merchant/stores/${storeId}/import`}
              className="font-semibold text-brand underline underline-offset-4"
            >
              Importar uma planilha
            </Link>
          </div>
        }
      >
        Com os preços publicados, sua loja entra nas comparações de quem está por perto.
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        <Stat value={data.productsListed} label="produtos com preço" />
        <Stat value={data.activeOffers} label="ofertas valendo" />
        <Stat value={data.belowMedian} label="abaixo da mediana da região" />
        <Stat value={data.aboveMedian} label="acima da mediana da região" />
      </div>

      <section aria-labelledby="divergences">
        <h2 id="divergences" className="text-2xl font-bold">
          Notas fiscais com preço diferente
        </h2>
        <p className="mt-1 text-ink-soft">
          Clientes enviaram notas desta loja com valor mais de 15 % diferente do preço que você informou, nos últimos 7
          dias. Confira se a etiqueta ou o cadastro estão certos.
        </p>
        {data.divergences.length === 0 ? (
          <p className="mt-3 text-ink-soft">Nenhuma diferença encontrada.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-surface">
            {data.divergences.map((item) => (
              <li key={item.productId} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <span className="font-medium">{item.canonicalName}</span>
                <span className="text-[0.95rem] tabular-nums">
                  Você: {brl(item.merchantPrice)} · Nota: {brl(item.receiptPrice)}{" "}
                  <strong className={item.difference < 0 ? "text-success" : "text-danger"}>
                    ({pct(item.difference)})
                  </strong>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="demand">
        <h2 id="demand" className="text-2xl font-bold">
          O que procuram perto da sua loja
        </h2>
        <p className="mt-1 text-ink-soft">
          Quantas listas pediram cada produto nos últimos 7 dias, num raio de cerca de 1,5 km. Só aparecem produtos
          pedidos por pelo menos 10 listas; ninguém é identificado.
        </p>
        {data.demand.length === 0 ? (
          <p className="mt-3 text-ink-soft">Ainda não há listas suficientes nesta região.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-surface">
            {data.demand.map((item) => (
              <li key={item.productId} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-medium">{item.canonicalName}</span>
                  {!item.listed && <span className="ml-2 text-[0.85rem] text-warning">sem preço na sua loja</span>}
                </span>
                <span className="text-ink-soft tabular-nums">{item.lists} listas</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
