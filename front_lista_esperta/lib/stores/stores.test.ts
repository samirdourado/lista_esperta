import { describe, expect, it } from "vitest";
import { formatDistance } from "@/components/stores/StoreSummary";
import { isValidCnpj, maskCnpj } from "@/lib/cnpj";
import { storeKind } from "./categories";
import { defaultStoreForm, storeFormSchema, toCreateStoreBody } from "./store-form";

describe("CNPJ (front)", () => {
  it("validates check digits like the API", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });

  it("masks while typing", () => {
    expect(maskCnpj("1122")).toBe("11.22");
    expect(maskCnpj("11222333000181999")).toBe("11.222.333/0001-81");
  });
});

describe("store form", () => {
  const valid = {
    ...defaultStoreForm("Mercado Bom Preço", { street: "Rua A", city: "São Paulo", state: "SP" }),
    cnpj: "11.222.333/0001-81",
    postcode: "04036-000",
    categories: ["alimentos"],
  };

  it("accepts a complete store and builds the API body", () => {
    const values = storeFormSchema.parse(valid);
    const body = toCreateStoreBody(values, { lat: -23.58, lng: -46.63 });
    expect(body).toMatchObject({
      name: "Mercado Bom Preço",
      cnpj: "11222333000181",
      lat: -23.58,
      address: { street: "Rua A", city: "São Paulo", state: "SP", postcode: "04036-000" },
      categorySlugs: ["alimentos"],
    });
    expect(body.openingHours?.weekly).toMatchObject({
      mon: [{ open: "08:00", close: "20:00" }],
      sat: [{ open: "08:00", close: "18:00" }],
      sun: [],
    });
    expect(body).not.toHaveProperty("confirmNotDuplicate");
    expect(toCreateStoreBody(values, { lat: 0, lng: 0 }, true).confirmNotDuplicate).toBe(true);
  });

  it("explains what is missing in Portuguese", () => {
    const result = storeFormSchema.safeParse({ ...valid, cnpj: "123", state: "Sao", categories: [] });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((issue) => issue.message);
    expect(messages).toContain("Esse CNPJ não é válido. Confira os números.");
    expect(messages).toContain("Use a sigla do estado, como SP.");
    expect(messages).toContain("Escolha pelo menos uma categoria.");
  });

  it("lets the CNPJ be left empty", () => {
    expect(storeFormSchema.safeParse({ ...valid, cnpj: "" }).success).toBe(true);
  });
});

describe("store display helpers", () => {
  it("formats distances for people", () => {
    expect(formatDistance(0.004)).toBe("10 m");
    expect(formatDistance(0.347)).toBe("350 m");
    expect(formatDistance(2.46)).toBe("2,5 km");
    expect(formatDistance(undefined)).toBeNull();
  });

  it("names the most specific kind of store", () => {
    expect(storeKind(["alimentos", "padaria"])).toBe("Padaria");
    expect(storeKind(["farmacia"])).toBe("Farmácia");
    expect(storeKind([])).toBeNull();
  });
});
