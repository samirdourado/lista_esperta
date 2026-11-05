// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { base64UrlToBytes } from "@/lib/alerts/push";
import type { PriceAlert } from "@/lib/alerts/queries";

const state = vi.hoisted(() => ({
  user: null as null | { defaultRadiusKm: number },
  alerts: [] as PriceAlert[],
  create: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.params }));
vi.mock("@/lib/session", () => ({ useSession: () => ({ data: state.user, isPending: false }) }));
vi.mock("@/lib/alerts/push", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/alerts/push")>()),
  usePush: () => ({ status: "ready", enable: vi.fn(), disable: vi.fn(), test: vi.fn() }),
}));
vi.mock("@/lib/alerts/queries", () => ({
  useAlerts: () => ({ data: state.alerts, isPending: false, isError: false }),
  useCreateAlert: () => ({ mutate: state.create, isPending: false, isError: false }),
  useUpdateAlert: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAlert: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/location/use-location", () => ({
  useLocation: () => ({ status: "ready", point: { lat: -23.58, lng: -46.63 }, source: "gps", locate: vi.fn() }),
}));
vi.mock("@/lib/merchant/queries", () => ({ useProductSearch: () => ({ data: [] }) }));

const { AlertsView } = await import("./AlertsView");

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  state.user = { defaultRadiusKm: 2 };
  state.alerts = [];
  state.create.mockReset();
  state.params = new URLSearchParams();
});

describe("AlertsView", () => {
  it("invites guests to create an account", () => {
    state.user = null;
    render(wrap(<AlertsView />));
    expect(screen.getByRole("link", { name: "Criar conta grátis" })).toHaveAttribute("href", "/register?next=/alerts");
  });

  it("creates an alert for the product picked in the verdict, near the shopper", async () => {
    const user = userEvent.setup();
    state.params = new URLSearchParams({ product: "milk", name: "Leite UHT integral 1 L" });
    render(wrap(<AlertsView />));
    expect(screen.getByText("Leite UHT integral 1 L")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "2 km" })).toBeChecked();
    await user.type(screen.getByRole("textbox", { name: "Avisar quando custar até (R$)" }), "4,99");
    await user.click(screen.getByRole("button", { name: "Criar alerta" }));
    expect(state.create).toHaveBeenCalledWith(
      { productId: "milk", targetPrice: 4.99, origin: { lat: -23.58, lng: -46.63 }, radiusKm: 2 },
      expect.anything(),
    );
  });

  it("shows each alert with the lowest price nearby now", () => {
    state.alerts = [
      {
        id: "a1",
        product: { id: "milk", canonicalName: "Leite UHT integral 1 L" },
        targetPrice: 5,
        radiusKm: 5,
        origin: { lat: -23.58, lng: -46.63 },
        active: true,
        best: { price: 4.8, storeId: "s1", storeName: "Mercado Perto", distanceKm: 0.5, source: "NFCE" },
        notifiedAt: null,
        createdAt: "2026-11-05T10:00:00Z",
      },
    ];
    render(wrap(<AlertsView />));
    expect(screen.getByText(/Agora: R\$\s4,80 no Mercado Perto \(0,5 km\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
  });
});

describe("base64UrlToBytes", () => {
  it("decodes VAPID keys written in base64url", () => {
    expect([...base64UrlToBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});
