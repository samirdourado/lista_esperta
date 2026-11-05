// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { ReceiptResult } from "@/lib/receipts/queries";

const mocks = vi.hoisted(() => ({
  qr: { mutate: vi.fn(), data: undefined as unknown, error: null as unknown, isPending: false, reset: vi.fn() },
  photo: { mutate: vi.fn(), data: undefined as unknown, error: null as unknown, isPending: false, reset: vi.fn() },
  key: { mutateAsync: vi.fn(), error: null as unknown, isPending: false, reset: vi.fn() },
}));
vi.mock("@/lib/receipts/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/receipts/queries")>()),
  useImportQr: () => mocks.qr,
  useImportPhoto: () => mocks.photo,
  useKeyInfo: () => mocks.key,
}));
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  useSession: () => ({ data: null, isPending: false }),
}));
vi.mock("./QrScanner", () => ({ QrScanner: () => <div>câmera</div> }));

const { ReceiptImport } = await import("./ReceiptImport");

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mocks.qr = { mutate: vi.fn(), data: undefined, error: null, isPending: false, reset: vi.fn() };
  mocks.photo = { mutate: vi.fn(), data: undefined, error: null, isPending: false, reset: vi.fn() };
  mocks.key = { mutateAsync: vi.fn(), error: null, isPending: false, reset: vi.fn() };
});

async function openTextForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Colar o link do QR Code ou digitar a chave de acesso"));
}

describe("ReceiptImport", () => {
  it("sends a pasted QR link to the API", async () => {
    const user = userEvent.setup();
    render(wrap(<ReceiptImport />));
    await openTextForm(user);
    await user.type(
      screen.getByLabelText("Link do QR Code ou chave de 44 números"),
      "https://www.nfce.fazenda.sp.gov.br/x?p=35",
    );
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(mocks.qr.mutate).toHaveBeenCalledWith("https://www.nfce.fazenda.sp.gov.br/x?p=35");
  });

  it("explains that a typed key alone cannot be read", async () => {
    const user = userEvent.setup();
    mocks.key.mutateAsync.mockResolvedValue({
      valid: true,
      uf: "SP",
      cnpj: "1",
      month: "2026-11",
      supported: true,
      alreadySent: false,
      error: null,
    });
    render(wrap(<ReceiptImport />));
    await openTextForm(user);
    await user.type(screen.getByLabelText("Link do QR Code ou chave de 44 números"), "3526 1111 2223");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Chave válida")).toBeInTheDocument();
    expect(screen.getByText(/Nota de SP, emitida em 11\/2026/)).toBeInTheDocument();
  });

  it("turns API error codes into Portuguese messages", () => {
    mocks.qr.error = new ApiError(422, "x", { code: "UF_NOT_SUPPORTED" });
    render(wrap(<ReceiptImport />));
    expect(screen.getByRole("alert")).toHaveTextContent("Por enquanto lemos notas de São Paulo");
  });

  it("shows which lines became prices", () => {
    const result: ReceiptResult = {
      id: "r1",
      accessKey: "3526",
      store: { id: "s1", name: "Bom Preço" },
      issuedAt: "2026-11-03T21:42:10.000Z",
      total: 46.51,
      pricesAdded: 2,
      source: "SEFAZ",
      lines: [
        {
          description: "LT LEITE",
          quantity: 2,
          unit: "UN",
          unitPrice: 5.49,
          totalPrice: 10.98,
          status: "MATCHED",
          productName: "Leite UHT Integral Itambé 1 L",
        },
        {
          description: "BANANA PRATA KG",
          quantity: 1.235,
          unit: "KG",
          unitPrice: 6.99,
          totalPrice: 8.63,
          status: "PENDING",
          productName: "Banana prata",
        },
      ],
    };
    mocks.qr.data = result;
    render(wrap(<ReceiptImport />));
    expect(screen.getByText("2 preços adicionados. Obrigado!")).toBeInTheDocument();
    expect(screen.getByText(/1 item ainda vai ser conferido/)).toBeInTheDocument();
    expect(screen.getByText("Leite UHT Integral Itambé 1 L")).toBeInTheDocument();
    expect(screen.getByText(/em conferência/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar conta grátis" })).toBeInTheDocument();
  });
});
