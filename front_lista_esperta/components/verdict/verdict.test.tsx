// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { evidenceLabel, type Verdict } from "@/lib/verdict/queries";

vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  useSession: () => ({ data: null, isPending: false }),
}));

const { VerdictView } = await import("./VerdictView");

const store = (id: string, name: string) => ({
  id,
  name,
  lat: -23.58,
  lng: -46.63,
  address: { street: "Rua A", city: "São Paulo" },
  verificationStatus: "VERIFIED" as const,
  openNow: true,
});
const HOUR_AGO = new Date(Date.now() - 2 * 3600_000).toISOString();

const verdict: Verdict = {
  items: [
    {
      index: 0,
      text: "leite",
      quantity: 2,
      productId: "milk",
      productName: "Leite UHT Integral 1 L",
      priced: true,
      regionalMedian: 5.5,
    },
    {
      index: 1,
      text: "arroz",
      quantity: 1,
      productId: "rice",
      productName: "Arroz 5 kg",
      priced: true,
      regionalMedian: 26,
    },
    { index: 2, text: "xpto", quantity: 1, productId: null, productName: null, priced: false, regionalMedian: null },
  ],
  ranking: [
    {
      store: store("a", "Atacado Médio"),
      itemsCost: 35.3,
      missingPenalty: 0,
      travelKm: 2.2,
      travelMinutes: 6,
      totalCost: 37.5,
      found: 2,
      priced: 2,
      missing: [],
      lines: [
        {
          index: 0,
          unitPrice: 5.2,
          subtotal: 10.4,
          evidence: { source: "NFCE", observedAt: HOUR_AGO, receiptCount: 3, offer: false },
        },
        {
          index: 1,
          unitPrice: 24.9,
          subtotal: 24.9,
          evidence: { source: "MERCHANT", observedAt: HOUR_AGO, receiptCount: 0, offer: false },
        },
        { index: 2, unitPrice: null, subtotal: null, evidence: null },
      ],
    },
    {
      store: store("b", "Mercado Perto"),
      itemsCost: 38,
      missingPenalty: 0,
      travelKm: 1,
      travelMinutes: 3,
      totalCost: 39,
      found: 2,
      priced: 2,
      missing: [],
      lines: [],
    },
  ],
  split: {
    stores: [store("b", "Mercado Perto"), store("a", "Atacado Médio")],
    assignment: { 0: "b", 1: "a" },
    itemsCost: 30,
    missingPenalty: 0,
    travelKm: 3,
    travelMinutes: 9,
    totalCost: 25,
    savings: 12.5,
  },
  params: {
    radiusKm: 5,
    splitMinSavings: 10,
    splitMinShare: 0.05,
    routing: "ESTIMATE",
    storesConsidered: 2,
    storesClosed: 1,
    storesWithoutPrices: 1,
    pendingAreas: 0,
  },
  unpricedStores: [{ store: store("q", "Quitanda Sem Preço"), distanceKm: 0.4 }],
  sponsored: [{ storeId: "b", storeName: "Mercado Perto", title: "Leite em oferta", label: "Patrocinado" }],
  computedAt: new Date().toISOString(),
};
const items = [
  { freeText: "leite", quantity: 2 },
  { freeText: "arroz", quantity: 1 },
  { freeText: "xpto", quantity: 1 },
];

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe("VerdictView", () => {
  it("answers with the cheapest store, its total and what is included", () => {
    render(wrap(<VerdictView verdict={verdict} items={items} />));
    expect(screen.getByRole("heading", { level: 2, name: "Atacado Médio" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "37 reais e 50 centavos" })).toBeInTheDocument();
    expect(screen.getByText("2 de 2")).toBeInTheDocument();
    expect(screen.getByText(/visto há 2 h · 3 notas fiscais/)).toBeInTheDocument();
    expect(screen.getByText("Preço informado pela loja")).toBeInTheDocument();
  });

  it("suggests the split, lists items nobody prices and says the distances are estimated", () => {
    render(wrap(<VerdictView verdict={verdict} items={items} />));
    expect(
      screen.getByRole("heading", { name: /Dividindo em duas lojas você economiza R\$\s?12,50/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma loja por perto tem preço para: xpto/)).toBeInTheDocument();
    expect(screen.getByText(/Distâncias estimadas/)).toBeInTheDocument();
    expect(screen.getByText(/1 lojas fechadas agora ficaram de fora/)).toBeInTheDocument();
  });

  it("keeps sponsored content in its own labelled block, outside the ranking", () => {
    render(wrap(<VerdictView verdict={verdict} items={items} />));
    const sponsored = screen.getByRole("complementary", { name: "Patrocinado" });
    expect(within(sponsored).getByText("Leite em oferta")).toBeInTheDocument();
    const ranking = screen.getByRole("region", { name: "Outras lojas por perto" });
    expect(within(ranking).queryByText("Leite em oferta")).not.toBeInTheDocument();
    expect(within(ranking).getByText("2º")).toBeInTheDocument();
  });

  it("explains when no store nearby has prices yet", () => {
    render(wrap(<VerdictView verdict={{ ...verdict, ranking: [], split: null, sponsored: [] }} items={items} />));
    expect(screen.getByText("Ainda não temos preços desses itens perto de você")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enviar uma nota fiscal" })).toHaveAttribute("href", "/?painel=nota");
    expect(screen.getByText("1 loja no raio ainda sem preço")).toBeInTheDocument();
  });
});

describe("evidenceLabel", () => {
  it("describes where each price comes from", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");
    expect(
      evidenceLabel({ source: "NFCE", observedAt: "2026-11-05T11:30:00Z", receiptCount: 1, offer: false }, now),
    ).toBe("visto há 30 min · 1 nota fiscal");
    expect(
      evidenceLabel({ source: "MERCHANT", observedAt: "2026-11-01T00:00:00Z", receiptCount: 0, offer: true }, now),
    ).toBe("Oferta informada pela loja");
    expect(
      evidenceLabel({ source: "COMMUNITY", observedAt: "2026-11-02T12:00:00Z", receiptCount: 0, offer: false }, now),
    ).toBe("Informado por clientes · há 3 dias");
  });
});
