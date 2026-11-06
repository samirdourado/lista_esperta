// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { Store } from "@/lib/stores/queries";

vi.mock("@/components/map/StoreMap", () => ({
  StoreMap: ({ stores }: { stores: unknown[] }) => <div data-testid="map">{stores.length} no mapa</div>,
}));
vi.mock("@/components/map/PinPicker", () => ({ PinPicker: () => <div data-testid="pin" /> }));

const location = vi.hoisted(() => ({
  value: {
    status: "idle",
    point: undefined as { lat: number; lng: number } | undefined,
    source: undefined as string | undefined,
  },
  locate: vi.fn(),
  setManual: vi.fn(),
}));
vi.mock("@/lib/location/use-location", () => ({
  useLocation: () => ({ ...location.value, locate: location.locate, setManual: location.setManual }),
}));

const queries = vi.hoisted(() => ({
  create: vi.fn(),
}));
vi.mock("@/lib/stores/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stores/queries")>()),
  useAddressSearch: () => ({ data: [], isFetching: false, isError: false, isSuccess: false }),
  useCreateStore: () => ({ mutateAsync: queries.create }),
}));
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  useSession: () => ({ data: null, isPending: false }),
}));

const { StoreForm } = await import("@/components/merchant/StoreForm");

const store = (overrides: Partial<Store>): Store => ({
  id: "s1",
  name: "Mercado do Mapa",
  cnpj: null,
  source: "OSM",
  verificationStatus: "UNVERIFIED",
  lat: -23.58,
  lng: -46.63,
  address: { street: "Rua Vergueiro", number: "100", city: "São Paulo" },
  openingHours: null,
  categories: ["alimentos"],
  managed: false,
  distanceKm: 0.35,
  ...overrides,
});

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  location.value = { status: "idle", point: undefined, source: undefined };
  location.locate.mockReset();
  queries.create.mockReset();
});

describe("StoreForm", () => {
  it("offers to claim the existing store when the API finds a duplicate", async () => {
    const user = userEvent.setup();
    const onClaimInstead = vi.fn();
    queries.create.mockRejectedValueOnce(
      new ApiError(409, "dup", { code: "POSSIBLE_DUPLICATE", storeId: "s9", storeName: "Mercado do Mapa" }),
    );
    render(
      wrap(
        <StoreForm
          initialName="Mercado do Mapa"
          initialPoint={{ lat: -23.58, lng: -46.63 }}
          initialAddress={{ street: "Rua Vergueiro", city: "São Paulo", state: "SP" }}
          onCreated={vi.fn()}
          onClaimInstead={onClaimInstead}
        />,
      ),
    );
    await user.click(screen.getByRole("checkbox", { name: "Alimentos e mercado" }));
    await user.click(screen.getByRole("button", { name: "Cadastrar loja" }));

    expect(await screen.findByText("Já existe “Mercado do Mapa” neste ponto do mapa")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "É a minha loja: pedir para administrar" }));
    expect(onClaimInstead).toHaveBeenCalledWith({ storeId: "s9", storeName: "Mercado do Mapa" });

    queries.create.mockResolvedValueOnce({ store: store({}), verification: null, verificationError: null });
    await user.click(screen.getByRole("button", { name: "É outra loja: cadastrar mesmo assim" }));
    expect(queries.create).toHaveBeenLastCalledWith(expect.objectContaining({ confirmNotDuplicate: true }));
  });

  it("requires the address and a category before sending", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <StoreForm initialName="Loja" initialPoint={{ lat: 0, lng: 0 }} onCreated={vi.fn()} onClaimInstead={vi.fn()} />,
      ),
    );
    await user.click(screen.getByRole("button", { name: "Cadastrar loja" }));
    expect(await screen.findByText("Informe a rua.")).toBeInTheDocument();
    expect(screen.getByText("Escolha pelo menos uma categoria.")).toBeInTheDocument();
    expect(queries.create).not.toHaveBeenCalled();
  });
});
