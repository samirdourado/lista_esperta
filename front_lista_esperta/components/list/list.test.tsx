// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { genericFor, matchQueries, searchCatalog } from "@/lib/catalog/generic-products";
import { pickCandidates } from "@/lib/directory/match";
import { parseLine, splitLines } from "@/lib/list/line";

const mocks = vi.hoisted(() => ({ push: vi.fn(), save: vi.fn(), load: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/shopping-lists/current", () => ({ useCurrentList: () => ({ load: mocks.load, save: mocks.save }) }));
vi.mock("@/lib/verdict/queries", () => ({
  useParseListPhoto: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const { ShoppingListEditor } = await import("./ShoppingListEditor");

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const optionNames = () =>
  within(screen.getByRole("list", { name: "Produtos" }))
    .queryAllByRole("checkbox")
    .map((box) => box.closest("label")?.textContent ?? "");

beforeEach(() => {
  mocks.push.mockReset();
  mocks.save.mockReset().mockResolvedValue({});
  mocks.load.mockReset().mockResolvedValue(undefined);
});

describe("parseLine", () => {
  it("reads quantities without eating weights", () => {
    expect(parseLine("2 leite integral")).toEqual({ text: "leite integral", quantity: 2 });
    expect(parseLine("5 kg de arroz")).toEqual({ text: "5 kg de arroz", quantity: 1 });
  });

  it("splits pasted lists", () => {
    expect(splitLines("- arroz\n• feijão, café;\n\n")).toEqual(["arroz", "feijão", "café"]);
  });
});

describe("generic catalog", () => {
  it("autocompletes by the start of each word, without accents", () => {
    expect(searchCatalog("agu gas").map((p) => p.label)).toEqual([
      "Água com gás 300 ml",
      "Água com gás 500 ml",
      "Água com gás 1,5 L",
    ]);
    expect(searchCatalog("cafe sol").map((p) => p.label)).toEqual(["Café solúvel 100 g", "Café solúvel 200 g"]);
  });

  it("finds each store's brands by generic words, never another product", () => {
    const rice = genericFor("Arroz branco 5 kg")!;
    const brands = [
      { ean: "1", name: "ARROZ TIO JOAO BRANCO 5KG", imageUrl: null, storeCount: 50 },
      { ean: "2", name: "Arroz Camil Tipo 1 5kg", imageUrl: null, storeCount: 90 },
      { ean: "3", name: "ARROZ INTEGRAL TIO JOAO 5KG", imageUrl: null, storeCount: 70 },
      { ean: "4", name: "ARROZ TIO JOAO BRANCO 1KG", imageUrl: null, storeCount: 99 },
    ];
    expect(
      pickCandidates(matchQueries(rice)[0], brands, 5, rice.exclude)
        .map((b) => b.ean)
        .sort(),
    ).toEqual(["1", "2"]);

    const still = genericFor("Água mineral 1,5 L")!;
    const waters = [
      { ean: "a", name: "AGUA MINERAL CRYSTAL 1,5L", imageUrl: null, storeCount: 10 },
      { ean: "b", name: "AGUA MINERAL COM GAS CRYSTAL 1,5L", imageUrl: null, storeCount: 10 },
      { ean: "c", name: "AGUA ENTRE RIOS SEM GAS 1,5L", imageUrl: null, storeCount: 9 },
      { ean: "d", name: "AGUA MINERAL ORIGEN C/GAS 1,5L", imageUrl: null, storeCount: 9 },
      { ean: "e", name: "AGUA MINERAL AQUA S/ GAS 1,5L", imageUrl: null, storeCount: 8 },
    ];
    // "sem gás" is still water; "com gás" and "C/GAS" are not.
    expect(pickCandidates(matchQueries(still)[0], waters, 5, still.exclude).map((w) => w.ean)).toEqual(["a", "c", "e"]);
    const sparkling = genericFor("Água com gás 1,5 L")!;
    expect(pickCandidates(matchQueries(sparkling)[0], waters, 5, sparkling.exclude).map((w) => w.ean)).toEqual([
      "b",
      "d",
    ]);
  });
});

describe("ShoppingListEditor", () => {
  it("adds several products at once and takes them out of the options", async () => {
    const user = userEvent.setup();
    render(wrap(<ShoppingListEditor />));
    await user.click(screen.getByRole("button", { name: "Bebidas" }));
    await user.click(screen.getByRole("checkbox", { name: "Água mineral 300 ml" }));
    await user.click(screen.getByRole("checkbox", { name: "Água com gás 1,5 L" }));
    await user.click(screen.getByRole("button", { name: "Adicionar 2 itens à lista" }));

    expect(screen.getByRole("heading", { name: "Sua lista · 2 itens" })).toBeInTheDocument();
    expect(optionNames()).not.toContain("Água mineral 300 ml");
    await waitFor(() =>
      expect(mocks.save).toHaveBeenLastCalledWith([
        { freeText: "Água mineral 300 ml", quantity: 1 },
        { freeText: "Água com gás 1,5 L", quantity: 1 },
      ]),
    );

    // Removing it from the list offers it again.
    await user.click(screen.getByRole("button", { name: "Remover Água mineral 300 ml" }));
    expect(optionNames()).toContain("Água mineral 300 ml");
  });

  it("narrows the list while typing, across categories, and adds what is not in it", async () => {
    const user = userEvent.setup();
    render(wrap(<ShoppingListEditor />));
    await user.click(screen.getByRole("button", { name: "Limpeza" }));
    const search = screen.getByRole("searchbox", { name: "Buscar produto" });
    await user.type(search, "arroz 5");
    expect(optionNames()).toEqual(["Arroz branco 5 kg", "Arroz parboilizado 5 kg"]);
    await user.clear(search);
    await user.type(search, "pimenta do reino{Enter}");
    expect(screen.getByRole("heading", { name: "Sua lista · 1 item" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover pimenta do reino" })).toBeInTheDocument();
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
    expect(await screen.findByRole("button", { name: "Remover café" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver onde comprar" }));
    expect(mocks.push).toHaveBeenCalledWith("/verdict");
  });
});
