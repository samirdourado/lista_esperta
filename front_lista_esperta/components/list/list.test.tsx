// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseLine, splitLines } from "@/lib/list/line";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
  suggestions: [] as { id: string; canonicalName: string }[],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/shopping-lists/current", () => ({ useCurrentList: () => ({ load: mocks.load, save: mocks.save }) }));
vi.mock("@/lib/merchant/queries", () => ({ useProductSearch: () => ({ data: mocks.suggestions }) }));
vi.mock("@/lib/verdict/queries", () => ({
  useParseListPhoto: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const { ShoppingListEditor } = await import("./ShoppingListEditor");

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.save.mockReset().mockResolvedValue({});
  mocks.load.mockReset().mockResolvedValue(undefined);
  mocks.suggestions = [];
});

describe("parseLine", () => {
  it("reads quantities without eating weights", () => {
    expect(parseLine("2 leite integral")).toEqual({ text: "leite integral", quantity: 2 });
    expect(parseLine("3x sabão")).toEqual({ text: "sabão", quantity: 3 });
    expect(parseLine("ovos x 12")).toEqual({ text: "ovos", quantity: 12 });
    expect(parseLine("5 kg de arroz")).toEqual({ text: "5 kg de arroz", quantity: 1 });
    expect(parseLine("arroz 5kg")).toEqual({ text: "arroz 5kg", quantity: 1 });
  });

  it("splits pasted lists", () => {
    expect(splitLines("- arroz\n• feijão, café;\n\n")).toEqual(["arroz", "feijão", "café"]);
  });
});

describe("ShoppingListEditor", () => {
  it("adds typed items with their quantity and saves the list on the device", async () => {
    const user = userEvent.setup();
    render(wrap(<ShoppingListEditor />));
    await user.type(screen.getByRole("combobox", { name: "Adicionar item" }), "2 leite integral{Enter}");
    expect(screen.getByText("leite integral")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Quantidade de leite integral" })).toHaveTextContent("2");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith([{ freeText: "leite integral", quantity: 2 }]));
  });

  it("picks a catalog product from the autocomplete with the keyboard", async () => {
    const user = userEvent.setup();
    mocks.suggestions = [{ id: "p1", canonicalName: "Leite UHT Integral Itambé 1 L" }];
    render(wrap(<ShoppingListEditor />));
    const input = screen.getByRole("combobox", { name: "Adicionar item" });
    await user.type(input, "leite");
    await screen.findByRole("option", { name: "Leite UHT Integral Itambé 1 L" });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByText("Leite UHT Integral Itambé 1 L")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.save).toHaveBeenLastCalledWith([
        { freeText: "Leite UHT Integral Itambé 1 L", quantity: 1, productId: "p1" },
      ]),
    );
  });

  it("changes quantities, removes items and accepts a pasted list", async () => {
    const user = userEvent.setup();
    render(wrap(<ShoppingListEditor />));
    const input = screen.getByRole("combobox", { name: "Adicionar item" });
    fireEvent.paste(input, { clipboardData: { getData: () => "arroz 5kg\n2 feijão" } });
    expect(screen.getByRole("heading", { name: "Sua lista · 2 itens" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Aumentar" })[0]);
    expect(screen.getByRole("group", { name: "Quantidade de arroz 5kg" })).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Remover feijão" }));
    expect(screen.queryByText("feijão")).not.toBeInTheDocument();
  });

  it("reopens the last list and goes to the verdict", async () => {
    const user = userEvent.setup();
    mocks.load.mockResolvedValue({
      id: "l1",
      name: "Minha lista",
      updatedAt: "",
      items: [{ freeText: "café", quantity: 1 }],
    });
    render(wrap(<ShoppingListEditor />));
    expect(await screen.findByText("café")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver onde comprar" }));
    expect(mocks.push).toHaveBeenCalledWith("/verdict");
  });
});
