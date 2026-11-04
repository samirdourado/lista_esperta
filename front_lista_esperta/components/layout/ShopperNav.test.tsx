// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isCurrent, SHOPPER_NAV } from "@/lib/navigation";
import { TabBar } from "./ShopperNav";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

describe("isCurrent", () => {
  const [list, receipts] = SHOPPER_NAV;

  it("treats the verdict as part of the list flow", () => {
    expect(isCurrent(list, "/")).toBe(true);
    expect(isCurrent(list, "/verdict")).toBe(true);
    expect(isCurrent(list, "/receipts/import")).toBe(false);
  });

  it("matches nested paths but not lookalike prefixes", () => {
    expect(isCurrent(receipts, "/receipts/import/scan")).toBe(true);
    expect(isCurrent(receipts, "/receipts/importer")).toBe(false);
  });
});

describe("TabBar", () => {
  beforeEach(() => {
    pathname.value = "/";
  });

  it("marks exactly one tab as the current page", () => {
    pathname.value = "/receipts/import";
    render(<TabBar />);
    const nav = screen.getByRole("navigation", { name: "Principal" });
    const current = within(nav)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Enviar nota");
  });
});
