// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminProduct, DuplicatePair, PendingAlias } from "@/lib/admin/queries";

const product = (overrides: Partial<AdminProduct>): AdminProduct => ({
  id: "p1",
  canonicalName: "Banana prata",
  brand: null,
  gtin: null,
  unit: "KG",
  unitQuantity: 1,
  prices: 0,
  ...overrides,
});

const state = vi.hoisted(() => ({
  aliases: [] as PendingAlias[],
  pairs: [] as DuplicatePair[],
  decide: vi.fn(),
  merge: vi.fn(),
  search: [] as { id: string; canonicalName: string; unit: string; unitQuantity: number }[],
}));
vi.mock("@/lib/admin/queries", () => ({
  usePendingAliases: () => ({ data: state.aliases, isPending: false, isError: false }),
  useDecideAlias: () => ({ mutate: state.decide, isError: false }),
  useDuplicates: () => ({ data: state.pairs, isPending: false, isError: false }),
  useMergeProducts: () => ({ mutate: state.merge, isError: false }),
}));
vi.mock("@/lib/merchant/queries", () => ({ useProductSearch: () => ({ data: state.search }) }));

const { CatalogModerationView } = await import("./AdminViews");

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  state.decide.mockReset();
  state.merge.mockReset();
  state.search = [];
  state.aliases = [
    {
      id: "a1",
      rawText: "BANANA PRATA KG",
      store: { id: "s1", name: "Mercado Perto" },
      product: product({}),
      occurrences: 3,
      createdAt: "2026-11-05T10:00:00Z",
    },
  ];
  state.pairs = [
    {
      a: product({ id: "k", canonicalName: "Leite UHT Integral Itambé 1 L", unit: "L", brand: "Itambé", prices: 4 }),
      b: product({ id: "m", canonicalName: "Leite UHT integral Itambe 1 L", unit: "L", gtin: "7896051111153" }),
      score: 0.82,
    },
  ];
});

describe("CatalogModerationView", () => {
  it("shows what the model suggested and confirms, rejects or picks another product", async () => {
    const user = userEvent.setup();
    render(wrap(<CatalogModerationView />));
    const card = screen.getByText("BANANA PRATA KG").closest("li")!;
    expect(within(card).getByText(/Mercado Perto · visto 3 vezes/)).toBeInTheDocument();
    expect(within(card).getByText("Banana prata")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "É esse produto" }));
    expect(state.decide).toHaveBeenLastCalledWith(
      { aliasId: "a1", approve: true, productId: undefined },
      expect.anything(),
    );
    await user.click(within(card).getByRole("button", { name: "Recusar" }));
    expect(state.decide).toHaveBeenLastCalledWith(
      { aliasId: "a1", approve: false, productId: undefined },
      expect.anything(),
    );

    state.search = [{ id: "p9", canonicalName: "Banana nanica", unit: "KG", unitQuantity: 1 }];
    await user.click(within(card).getByRole("button", { name: "É outro produto" }));
    await user.type(within(card).getByRole("textbox", { name: "Buscar o produto certo" }), "banana");
    await user.click(within(card).getByRole("button", { name: "Usar este" }));
    expect(state.decide).toHaveBeenLastCalledWith({ aliasId: "a1", approve: true, productId: "p9" }, expect.anything());
  });

  it("merges a duplicate into the product the admin keeps", async () => {
    const user = userEvent.setup();
    render(wrap(<CatalogModerationView />));
    expect(screen.getByText("82% parecidos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: 'Manter "Leite UHT Integral Itambé 1 L"' }));
    expect(state.merge).toHaveBeenCalledWith({ keepId: "k", mergeId: "m" }, expect.anything());
  });

  it("says when there is nothing to review", () => {
    state.aliases = [];
    state.pairs = [];
    render(wrap(<CatalogModerationView />));
    expect(screen.getByText("Nada para confirmar.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum duplicado encontrado.")).toBeInTheDocument();
  });
});
