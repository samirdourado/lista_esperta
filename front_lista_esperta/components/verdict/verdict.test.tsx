// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      webPrice: { price: 4.85, store: "Zaffari Online", title: "Leite Integral 1l", seenAt: HOUR_AGO },
    },
    {
      index: 1,
      text: "arroz",
      quantity: 1,
      productId: "rice",
      productName: "Arroz 5 kg",
      priced: true,
      regionalMedian: 26,
      webPrice: null,
    },
    {
      index: 2,
      text: "xpto",
      quantity: 1,
      productId: null,
      productName: null,
      priced: false,
      regionalMedian: null,
      webPrice: { price: 9.9, store: "Loja Online", title: "Xpto", seenAt: HOUR_AGO },
    },
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
          productName: "Leite Italac 1 L",
          imageUrl: "https://img.example/leite.webp",
          unitPrice: 5.2,
          subtotal: 10.4,
          evidence: { source: "NFCE", observedAt: HOUR_AGO, receiptCount: 3, offer: false },
        },
        {
          index: 1,
          productName: "Arroz Camil 5 kg",
          imageUrl: null,
          unitPrice: 24.9,
          subtotal: 24.9,
          evidence: { source: "MERCHANT", observedAt: HOUR_AGO, receiptCount: 0, offer: false },
        },
        { index: 2, unitPrice: null, subtotal: null, evidence: null, productName: null, imageUrl: null },
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
    addressesPending: 0,
    pendingAreas: 0,
  },
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
  it("lists the stores as an accordion with name, address, distance and list price", () => {
    render(wrap(<VerdictView verdict={verdict} items={items} />));
    const first = screen.getByRole("button", { name: /Atacado Médio/ });
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveTextContent("Rua A");
    expect(first).toHaveTextContent("1,1 km");
    expect(first).toHaveTextContent(/R\$\s?35,30/);
    expect(first).toHaveTextContent("2 de 3 itens");
  });

  it("opens to the list at that store: photo, name and price, and marks what it lacks", () => {
    const { container } = render(wrap(<VerdictView verdict={verdict} items={items} />));
    expect(screen.getAllByText(/Leite Italac 1 L/)[0]).toBeInTheDocument();
    expect(container.querySelector('img[src="https://img.example/leite.webp"]')).toBeInTheDocument();
    expect(screen.getAllByText(/visto há 2 h · 3 notas fiscais/)[0]).toBeInTheDocument();
    expect(screen.getAllByText("Não encontrado neste supermercado")[0]).toHaveClass("text-danger");
  });

  it("opens another store and closes the open one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(wrap(<VerdictView verdict={verdict} items={items} onSelect={onSelect} />));
    await user.click(screen.getByRole("button", { name: /Mercado Perto/ }));
    expect(onSelect).toHaveBeenCalledWith("b");
    const first = screen.getByRole("button", { name: /Atacado Médio/ });
    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
  });

  it("suggests the split and lists items nobody prices", () => {
    render(wrap(<VerdictView verdict={verdict} items={items} />));
    expect(
      screen.getByRole("heading", { name: /Dividindo em duas lojas você economiza R\$\s?12,50/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma loja por perto tem preço para: xpto \(na internet a partir de R\$\s9,90\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Distâncias estimadas/)).toBeInTheDocument();
  });

  it("credits PreçoMelhor when its prices are on screen", () => {
    const withDirectory: Verdict = JSON.parse(JSON.stringify(verdict));
    withDirectory.ranking[0].lines[0].evidence!.source = "PRECOMELHOR";
    render(wrap(<VerdictView verdict={withDirectory} items={items} />));
    expect(screen.getByRole("link", { name: "PreçoMelhor" })).toHaveAttribute("href", "https://www.precomelhor.com.br");
  });

  it("keeps sponsored content in its own labelled block, outside the ranking", () => {
    render(wrap(<VerdictView verdict={verdict} items={items} />));
    const sponsored = screen.getByRole("complementary", { name: "Patrocinado" });
    expect(within(sponsored).getByText("Leite em oferta")).toBeInTheDocument();
    const ranking = screen.getByRole("list", { name: "Lojas com produtos da sua lista" });
    expect(within(ranking).queryByText("Leite em oferta")).not.toBeInTheDocument();
  });

  it("explains when no store nearby has prices yet", () => {
    render(wrap(<VerdictView verdict={{ ...verdict, ranking: [], split: null, sponsored: [] }} items={items} />));
    expect(screen.getByText("Ainda não temos preços desses itens perto de você")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enviar uma nota fiscal" })).toHaveAttribute("href", "/?painel=nota");
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
