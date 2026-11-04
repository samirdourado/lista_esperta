// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

const nav = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.replace }),
  useSearchParams: () => nav.params,
}));

const auth = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  useSignIn: () => ({ mutateAsync: auth.signIn }),
  useSignUp: () => ({ mutateAsync: auth.signUp }),
}));

const merchant = {
  id: "u1",
  email: "loja@example.com",
  role: "MERCHANT" as const,
  displayName: "Loja",
  costPerKm: 1,
  valuePerHour: 0,
  defaultRadiusKm: 5,
  storeIds: [],
};

function wrap(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  nav.replace.mockReset();
  nav.params = new URLSearchParams();
  auth.signIn.mockReset();
  auth.signUp.mockReset();
});

describe("RegisterForm", () => {
  it("starts on 'Tenho uma loja' when coming from the merchant link", () => {
    nav.params = new URLSearchParams("type=merchant");
    render(wrap(<RegisterForm />));
    expect(screen.getByRole("radio", { name: /Tenho uma loja/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Criar conta e cadastrar loja" })).toBeInTheDocument();
  });

  it("shows field errors in Portuguese and does not submit", async () => {
    const user = userEvent.setup();
    render(wrap(<RegisterForm />));
    await user.type(screen.getByLabelText("E-mail"), "sem-arroba");
    await user.type(screen.getByLabelText("Senha"), "curta");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Informe seu nome.")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido, como nome@exemplo.com.")).toBeInTheDocument();
    expect(screen.getByText("Use pelo menos 8 caracteres.")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("creates a merchant account and opens the store onboarding", async () => {
    const user = userEvent.setup();
    auth.signUp.mockResolvedValue(merchant);
    render(wrap(<RegisterForm />));
    await user.click(screen.getByRole("radio", { name: /Tenho uma loja/ }));
    await user.type(screen.getByLabelText(/Seu nome/), "Loja");
    await user.type(screen.getByLabelText("E-mail"), "loja@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-boa-123");
    await user.click(screen.getByRole("button", { name: "Criar conta e cadastrar loja" }));

    expect(auth.signUp).toHaveBeenCalledWith({
      role: "MERCHANT",
      displayName: "Loja",
      email: "loja@example.com",
      password: "senha-boa-123",
    });
    expect(nav.replace).toHaveBeenCalledWith("/merchant/onboarding");
  });

  it("explains a duplicate e-mail and links to the login", async () => {
    const user = userEvent.setup();
    auth.signUp.mockRejectedValue(new ApiError(409, "E-mail already registered"));
    render(wrap(<RegisterForm />));
    await user.type(screen.getByLabelText("Seu nome"), "Ana");
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-boa-123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma conta com este e-mail.");
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
  });
});

describe("LoginForm", () => {
  it("says the credentials are wrong on 401", async () => {
    const user = userEvent.setup();
    auth.signIn.mockRejectedValue(new ApiError(401, "Invalid e-mail or password"));
    render(wrap(<LoginForm />));
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
  });

  it("returns to the protected page that sent the person to log in", async () => {
    const user = userEvent.setup();
    nav.params = new URLSearchParams("next=/merchant&error=unavailable");
    auth.signIn.mockResolvedValue({ ...merchant, storeIds: ["s1"] });
    render(wrap(<LoginForm />));
    expect(screen.getByRole("status")).toHaveTextContent("Não conseguimos confirmar sua sessão");
    expect(screen.getByRole("link", { name: "Criar conta de lojista" })).toHaveAttribute(
      "href",
      "/register?type=merchant",
    );
    await user.type(screen.getByLabelText("E-mail"), "loja@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-boa-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(nav.replace).toHaveBeenCalledWith("/merchant");
  });
});
