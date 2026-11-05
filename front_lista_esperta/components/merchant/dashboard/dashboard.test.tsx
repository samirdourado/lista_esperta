// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/lib/merchant/queries";
import { moneyInput, parseMoney } from "./money";

const item = (overrides: Partial<CatalogItem>): CatalogItem => ({
  productId: "p1",
  gtin: "7896006716112",
  canonicalName: "Arroz branco 5 kg",
  brand: null,
  categorySlug: "mercearia",
  unit: "KG",
  unitQuantity: 5,
  regularPrice: 27.9,
  regularObservedAt: null,
  offerId: null,
  offerPrice: null,
  offerValidUntil: null,
  regionMedian: 25,
  regionStores: 3,
  receiptPrice: null,
  receiptAt: null,
  divergent: false,
  ...overrides,
});

const state = vi.hoisted(() => ({ items: [] as unknown[], setPrices: vi.fn() }));
vi.mock("./StoreShell", () => ({ useStoreId: () => "s1", useIsOwner: () => true }));
vi.mock("@/lib/merchant/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/merchant/queries")>()),
  useStoreCatalog: () => ({ data: state.items, isPending: false, isSuccess: true }),
  useSetPrices: () => ({ mutateAsync: state.setPrices, isPending: false, isError: false }),
  useWithdrawProduct: () => ({ mutate: vi.fn(), isError: false }),
  useEndOffer: () => ({ mutate: vi.fn(), isError: false }),
}));

const { CatalogView } = await import("./CatalogView");

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  state.setPrices.mockReset().mockResolvedValue({ saved: 1 });
  state.items = [
    item({}),
    item({
      productId: "p2",
      canonicalName: "Café torrado 500 g",
      unit: "G",
      unitQuantity: 500,
      regularPrice: 18.5,
      regionMedian: null,
      regionStores: 0,
      offerId: "9",
      offerPrice: 15.99,
      offerValidUntil: "2026-12-31T02:59:59.000Z",
    }),
  ];
});

describe("money helpers", () => {
  it("reads Brazilian amounts", () => {
    expect(parseMoney("12,90")).toBe(12.9);
    expect(parseMoney("R$ 1.234,56")).toBe(1234.56);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("0")).toBeNull();
    expect(moneyInput(12.9)).toBe("12,90");
  });
});

describe("CatalogView", () => {
  it("compares with the regional median and shows the running offer", () => {
    render(wrap(<CatalogView />));
    expect(screen.getByText(/12 % acima da mediana/)).toBeInTheDocument();
    expect(screen.getByText("Sem preços de outras lojas por perto")).toBeInTheDocument();
    expect(screen.getByText(/Oferta R\$\s?15,99 até/)).toBeInTheDocument();
  });

  it("saves only the prices that changed, in one request", async () => {
    const user = userEvent.setup();
    render(wrap(<CatalogView />));
    const rice = screen.getByLabelText("Preço de Arroz branco 5 kg");
    await user.clear(rice);
    await user.type(rice, "26,49");
    expect(screen.getByText("1 preço alterado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(state.setPrices).toHaveBeenCalledWith([{ productId: "p1", price: 26.49 }]);
    expect(await screen.findByText("1 preço atualizado.")).toBeInTheDocument();
  });

  it("blocks saving while a price is invalid", async () => {
    const user = userEvent.setup();
    render(wrap(<CatalogView />));
    const rice = screen.getByLabelText("Preço de Arroz branco 5 kg");
    await user.clear(rice);
    await user.type(rice, "abc");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
    expect(screen.getByText("Preço inválido")).toBeInTheDocument();
  });
});
