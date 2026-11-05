"use client";

import Link from "next/link";
import { useState } from "react";
import { addressLine } from "@/components/stores/StoreSummary";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  type AdminProduct,
  type PendingAlias,
  useAdminOverview,
  useDecideAlias,
  useDecideClaim,
  useDuplicates,
  useMergeProducts,
  usePendingAliases,
  usePendingClaims,
  usePendingStores,
  useSetVerification,
} from "@/lib/admin/queries";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { packLabel } from "@/lib/merchant/labels";
import { useProductSearch } from "@/lib/merchant/queries";

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const MERGE_ERROR: Record<string, string> = {
  SIZE_MISMATCH: "Tamanhos diferentes são produtos diferentes: não dá para mesclar.",
  BRAND_MISMATCH: "Marcas diferentes são produtos diferentes: não dá para mesclar.",
  GTIN_MISMATCH: "Os dois têm códigos de barras diferentes: são produtos diferentes.",
};

function failure(error: unknown, byCode: Record<string, string> = {}) {
  if (error instanceof ApiError && error.code && byCode[error.code]) return byCode[error.code];
  return errorMessage(error);
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-md border border-dashed border-line p-6 text-center text-ink-soft">{children}</p>;
}

function Loading({ query }: { query: { isPending: boolean; isError: boolean; error: unknown } }) {
  if (query.isPending) return <Skeleton className="h-32 w-full" />;
  if (query.isError) return <Notice tone="danger" title={errorMessage(query.error)} />;
  return null;
}

export function AdminOverviewView() {
  const overview = useAdminOverview();
  if (!overview.data) return <Loading query={overview} />;
  const cards = [
    { href: "/admin/claims", count: overview.data.pendingClaims, label: "pedidos para administrar uma loja" },
    { href: "/admin/stores", count: overview.data.pendingVerifications, label: "lojas com CNPJ para conferir" },
    {
      href: "/admin/catalog",
      count: overview.data.pendingAliases,
      label: "produtos de notas e encartes para confirmar",
    },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <li key={card.href}>
          <Link
            href={card.href}
            className="flex h-full flex-col rounded-md border border-line bg-surface p-4 hover:border-brand"
          >
            <span className="font-display text-4xl font-bold tabular-nums">{card.count}</span>
            <span className="text-ink-soft">{card.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ClaimsView() {
  const claims = usePendingClaims();
  const decide = useDecideClaim();
  if (!claims.data) return <Loading query={claims} />;
  if (claims.data.length === 0) return <Empty>Nenhum pedido esperando.</Empty>;
  return (
    <div className="flex flex-col gap-3">
      {decide.isError && <Notice tone="danger" title={failure(decide.error)} />}
      <ul className="flex flex-col gap-3">
        {claims.data.map((claim) => (
          <li key={claim.id} className="rounded-md border border-line bg-surface p-4">
            <p className="font-semibold">{claim.store.name}</p>
            <p className="text-[0.9rem] text-ink-soft">
              {addressLine(claim.store.address) ?? "Endereço não informado"}
              {claim.store.cnpj ? ` · CNPJ ${claim.store.cnpj}` : ""}
            </p>
            <p className="mt-2">
              <span className="font-medium">{claim.user.displayName}</span>{" "}
              <span className="text-ink-soft">({claim.user.email})</span> pediu em{" "}
              {DATE.format(new Date(claim.createdAt))}
            </p>
            {claim.message && (
              <blockquote className="mt-2 border-l-2 border-line pl-3 text-ink-soft">{claim.message}</blockquote>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                loading={decide.isPending && decide.variables?.claimId === claim.id && decide.variables.approve}
                onClick={() => decide.mutate({ claimId: claim.id, approve: true })}
              >
                Aprovar
              </Button>
              <Button variant="secondary" onClick={() => decide.mutate({ claimId: claim.id, approve: false })}>
                Recusar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CHECKS: { key: "active" | "sameState" | "sameCity" | "samePostcode" | "similarName"; label: string }[] = [
  { key: "active", label: "CNPJ ativo" },
  { key: "sameState", label: "Mesmo estado" },
  { key: "sameCity", label: "Mesma cidade" },
  { key: "samePostcode", label: "Mesmo CEP" },
  { key: "similarName", label: "Nome parecido" },
];

export function StoresView() {
  const stores = usePendingStores();
  const setVerification = useSetVerification();
  if (!stores.data) return <Loading query={stores} />;
  if (stores.data.length === 0) return <Empty>Nenhuma loja esperando verificação.</Empty>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-soft">
        O CNPJ existe e está ativo, mas algum dado não bateu com o cadastro da loja. Compare e decida.
      </p>
      {setVerification.isError && <Notice tone="danger" title={failure(setVerification.error)} />}
      <ul className="flex flex-col gap-3">
        {stores.data.map(({ store, company }) => (
          <li key={store.id} className="rounded-md border border-line bg-surface p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[0.85rem] text-ink-soft">Cadastro da loja</p>
                <p className="font-semibold">{store.name}</p>
                <p className="text-[0.9rem] text-ink-soft">{addressLine(store.address) ?? "Endereço não informado"}</p>
                <p className="text-[0.9rem] text-ink-soft">CNPJ {store.cnpj ?? "não informado"}</p>
              </div>
              <div>
                <p className="text-[0.85rem] text-ink-soft">Receita Federal</p>
                {company ? (
                  <>
                    <p className="font-semibold">{company.tradeName ?? company.legalName}</p>
                    {company.tradeName && <p className="text-[0.9rem] text-ink-soft">{company.legalName}</p>}
                    <p className="text-[0.9rem] text-ink-soft">
                      {[company.address.city, company.address.state, company.address.postcode]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </>
                ) : (
                  <p className="text-ink-soft">Sem consulta salva.</p>
                )}
              </div>
            </div>
            {company && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Conferências">
                {CHECKS.map((check) => (
                  <li key={check.key}>
                    <Badge tone={company.checks[check.key] ? "success" : "warning"}>
                      {company.checks[check.key] ? "✓" : "✗"} {check.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => setVerification.mutate({ storeId: store.id, status: "VERIFIED" })}>
                Marcar como verificada
              </Button>
              <Button
                variant="secondary"
                onClick={() => setVerification.mutate({ storeId: store.id, status: "UNVERIFIED" })}
              >
                Deixar sem verificação
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductLine({ product }: { product: AdminProduct }) {
  return (
    <span>
      <span className="font-medium">{product.canonicalName}</span>{" "}
      <span className="text-[0.9rem] text-ink-soft">
        · {packLabel(product.unit as never, product.unitQuantity)}
        {product.brand ? ` · ${product.brand}` : ""}
        {product.gtin ? ` · ${product.gtin}` : ""} · {product.prices} {product.prices === 1 ? "preço" : "preços"}
      </span>
    </span>
  );
}

/** Picks another catalog product when the model's suggestion was wrong. */
function OtherProduct({ alias, onPick }: { alias: PendingAlias; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const results = useProductSearch(q).data ?? [];
  return (
    <div className="mt-3 flex flex-col gap-2">
      <TextField
        id={`other-${alias.id}`}
        label="Buscar o produto certo"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        autoComplete="off"
      />
      {q.length >= 2 && (
        <ul className="divide-y divide-line rounded-md border border-line">
          {results.length === 0 && <li className="p-3 text-ink-soft">Nenhum produto com esse nome.</li>}
          {results.slice(0, 6).map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-3 px-3 py-1">
              <span>
                {product.canonicalName}{" "}
                <span className="text-[0.9rem] text-ink-soft">· {packLabel(product.unit, product.unitQuantity)}</span>
              </span>
              <Button size="md" variant="ghost" onClick={() => onPick(product.id)}>
                Usar este
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AliasesSection() {
  const aliases = usePendingAliases();
  const decide = useDecideAlias();
  const [choosing, setChoosing] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <section aria-labelledby="aliases" className="flex flex-col gap-3">
      <h2 id="aliases" className="text-xl font-bold">
        Produtos para confirmar
      </h2>
      <p className="text-ink-soft">
        Itens de notas e encartes que a leitura automática não teve certeza. O preço só entra na comparação depois que
        você confirma.
      </p>
      {done && <Notice tone="success" title={done} />}
      {decide.isError && <Notice tone="danger" title={failure(decide.error)} />}
      {!aliases.data ? (
        <Loading query={aliases} />
      ) : aliases.data.length === 0 ? (
        <Empty>Nada para confirmar.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {aliases.data.map((alias) => {
            const run = (approve: boolean, productId?: string) =>
              decide.mutate(
                { aliasId: alias.id, approve, productId },
                {
                  onSuccess: (result) => {
                    setChoosing(null);
                    setDone(
                      approve
                        ? `"${alias.rawText}" confirmado. ${result.pricesAdded} ${result.pricesAdded === 1 ? "preço entrou" : "preços entraram"} na comparação.`
                        : `"${alias.rawText}" recusado. Esse texto não vai mais ser associado a um produto.`,
                    );
                  },
                },
              );
            return (
              <li key={alias.id} className="rounded-md border border-line bg-surface p-4">
                <p className="font-mono text-[0.95rem] break-words">{alias.rawText}</p>
                <p className="text-[0.85rem] text-ink-soft">
                  {alias.store?.name ?? "Qualquer loja"} · visto {alias.occurrences}{" "}
                  {alias.occurrences === 1 ? "vez" : "vezes"}
                </p>
                <p className="mt-2">
                  <span className="text-ink-soft">Sugestão: </span>
                  <ProductLine product={alias.product} />
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => run(true)}>É esse produto</Button>
                  <Button
                    variant="secondary"
                    aria-expanded={choosing === alias.id}
                    onClick={() => setChoosing(choosing === alias.id ? null : alias.id)}
                  >
                    É outro produto
                  </Button>
                  <Button variant="ghost" onClick={() => run(false)}>
                    Recusar
                  </Button>
                </div>
                {choosing === alias.id && <OtherProduct alias={alias} onPick={(id) => run(true, id)} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DuplicatesSection() {
  const pairs = useDuplicates();
  const merge = useMergeProducts();
  const [done, setDone] = useState<string | null>(null);

  return (
    <section aria-labelledby="duplicates" className="flex flex-col gap-3">
      <h2 id="duplicates" className="text-xl font-bold">
        Possíveis duplicados
      </h2>
      <p className="text-ink-soft">
        Mesmo tamanho e marca, nomes parecidos. Ao mesclar, preços, listas e alertas passam para o produto que fica.
      </p>
      {done && <Notice tone="success" title={done} />}
      {merge.isError && <Notice tone="danger" title={failure(merge.error, MERGE_ERROR)} />}
      {!pairs.data ? (
        <Loading query={pairs} />
      ) : pairs.data.length === 0 ? (
        <Empty>Nenhum duplicado encontrado.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {pairs.data.map(({ a, b, score }) => (
            <li key={`${a.id}-${b.id}`} className="rounded-md border border-line bg-surface p-4">
              <p className="text-[0.85rem] text-ink-soft">{Math.round(score * 100)}% parecidos</p>
              <ul className="mt-1 flex flex-col gap-1">
                <li>
                  <ProductLine product={a} />
                </li>
                <li>
                  <ProductLine product={b} />
                </li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  [a, b],
                  [b, a],
                ].map(([keep, gone]) => (
                  <Button
                    key={keep.id}
                    variant="secondary"
                    onClick={() =>
                      merge.mutate(
                        { keepId: keep.id, mergeId: gone.id },
                        {
                          onSuccess: (result) =>
                            setDone(
                              `Mesclado em "${keep.canonicalName}". ${result.pricesMoved} preços passaram para ele.`,
                            ),
                        },
                      )
                    }
                  >
                    Manter &quot;{keep.canonicalName}&quot;
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CatalogModerationView() {
  return (
    <div className="flex flex-col gap-10">
      <AliasesSection />
      <DuplicatesSection />
    </div>
  );
}
