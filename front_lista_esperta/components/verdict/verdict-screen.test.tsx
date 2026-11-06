// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Verdict } from "@/lib/verdict/queries";

const panel = vi.hoisted(() => ({ value: null as string | null, replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: panel.replace, push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(panel.value ? { painel: panel.value } : {}),
}));
vi.mock("@/lib/stores/queries", () => ({
  usePlaceName: () => ({
    data: {
      label: "Estação Jurubatuba, Rua Engenheiro Alberto Kuhlmann, Jurubatuba, São Paulo",
      address: { street: "Rua Engenheiro Alberto Kuhlmann", number: "70", district: "Jurubatuba", city: "São Paulo" },
    },
  }),
}));
vi.mock("@/components/receipts/ReceiptImport", () => ({ ReceiptImport: () => <p>importar nota</p> }));

const { RadiusSlider } = await import("./RadiusSlider");
const { mapStores } = await import("./VerdictScreen");
const { LocationBar } = await import("@/components/location/LocationBar");
const { HomePanels } = await import("@/components/home/HomePanels");

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.useRealTimers();
  panel.value = null;
});

describe("RadiusSlider", () => {
  it("moves the number with the thumb and searches only after the person stops", () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    render(<RadiusSlider value={5} onCommit={commit} />);
    const slider = screen.getByRole("slider", { name: "Lojas até" });
    expect(slider).toHaveAttribute("min", "0.5");
    expect(slider).toHaveAttribute("max", "10");
    fireEvent.change(slider, { target: { value: "2.5" } });
    fireEvent.change(slider, { target: { value: "3" } });
    expect(screen.getByText("3 km")).toBeInTheDocument();
    expect(commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(3);
  });
});

describe("LocationBar", () => {
  it("names the place the GPS found and warns when the browser only guessed", () => {
    render(
      wrap(
        <LocationBar
          location={{ status: "ready", point: { lat: -23.66, lng: -46.7 }, source: "gps", accuracyM: 3200 }}
          onChange={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText("Rua Engenheiro Alberto Kuhlmann, 70 · Jurubatuba")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("aproximada (±3,2 km)");
  });
});

describe("mapStores", () => {
  it("labels priced stores with the list price and greys out shops without prices", () => {
    const store = (id: string) => ({
      id,
      name: id,
      lat: 0,
      lng: 0,
      address: null,
      verificationStatus: "UNVERIFIED",
      openNow: null,
    });
    const verdict = {
      ranking: [{ store: store("a"), totalCost: 52.46 }],
      unpricedStores: [{ store: store("q"), distanceKm: 0.3 }],
    } as unknown as Verdict;
    expect(mapStores(verdict)).toEqual([
      expect.objectContaining({ id: "q", muted: true }),
      expect.objectContaining({ id: "a", label: expect.stringMatching(/R\$\s52,46/) }),
    ]);
  });
});

describe("HomePanels", () => {
  it("opens 'Como calculamos' and the receipt upload from the URL, on the home page", () => {
    panel.value = "como-calculamos";
    const { rerender } = render(wrap(<HomePanels />));
    expect(screen.getByRole("link", { name: /Enviar nota fiscal/ })).toHaveAttribute("href", "/?painel=nota");
    expect(screen.getByText(/total = preço dos itens na loja/)).toBeInTheDocument();
    expect(screen.queryByText("importar nota")).not.toBeInTheDocument();

    panel.value = "nota";
    rerender(wrap(<HomePanels />));
    expect(screen.getByText("importar nota")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar", hidden: true })[0]);
    expect(panel.replace).toHaveBeenCalledWith("/", { scroll: false });
  });
});
