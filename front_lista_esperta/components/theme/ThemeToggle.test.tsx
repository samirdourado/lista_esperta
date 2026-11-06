// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "./theme";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("starts light and switches to dark and back, remembering the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Usar tema escuro" });
    expect(document.documentElement.dataset.theme).toBeUndefined();

    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(button).toHaveAccessibleName("Usar tema claro");

    await user.click(button);
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
