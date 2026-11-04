// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { TextField } from "./Field";
import { Notice } from "./Notice";

describe("Button", () => {
  it("is a non-submitting button by default and keeps the touch target class", () => {
    render(<Button>Ver onde comprar</Button>);
    const button = screen.getByRole("button", { name: "Ver onde comprar" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("min-h-tap");
  });

  it("blocks clicks and announces busy while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salvar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("TextField", () => {
  it("links the label, hint and error to the input", () => {
    render(<TextField label="E-mail" hint="Usamos só para o login." error="Informe um e-mail válido." />);
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Usamos só para o login. Informe um e-mail válido.");
  });

  it("is valid and undescribed without hint or error", () => {
    render(<TextField label="Nome" />);
    const input = screen.getByLabelText("Nome");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});

describe("Notice", () => {
  it("interrupts only for danger", () => {
    const { rerender } = render(<Notice tone="info" title="Preços simulados" />);
    expect(screen.getByRole("status")).toHaveTextContent("Preços simulados");
    rerender(<Notice tone="danger" title="Não foi possível ler a nota" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível ler a nota");
  });
});
