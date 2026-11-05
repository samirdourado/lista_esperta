import { describe, expect, it } from "vitest";
import type { User } from "@/lib/api/types";
import { homeFor, safeNext } from "./session";

const base: User = {
  id: "u1",
  email: "a@b.c",
  role: "SHOPPER",
  displayName: "A",
  costPerKm: 1,
  valuePerHour: 0,
  defaultRadiusKm: 5,
  storeIds: [],
};

describe("safeNext", () => {
  it("accepts same-site paths only", () => {
    expect(safeNext("/merchant?tab=prices")).toBe("/merchant?tab=prices");
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("homeFor", () => {
  it("sends merchants without a store to onboarding", () => {
    expect(homeFor({ ...base, role: "MERCHANT" })).toBe("/merchant/onboarding");
    expect(homeFor({ ...base, role: "MERCHANT", storeIds: ["s1"] })).toBe("/merchant");
    expect(homeFor(base)).toBe("/");
  });
});
