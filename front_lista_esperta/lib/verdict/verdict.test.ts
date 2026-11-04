import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { selectSponsored } from "@/lib/ads/select";
import { PILOT_CENTER } from "@/lib/demo/stores";
import { EXAMPLE_LIST, splitLines } from "@/lib/list/parse";
import { buildVerdict, type VerdictInput } from "@/lib/verdict/build";
import { chooseVerdict, evaluate, type Matrix, type Plan } from "@/lib/verdict/optimize";
import { makeTravel } from "@/lib/verdict/travel";

const input: VerdictInput = {
  lines: splitLines(EXAMPLE_LIST).map((raw) => ({ raw })),
  origin: PILOT_CENTER,
  radiusM: 3000,
  mode: "DRIVE",
};

describe("neutralidade (Seção 3.6)", () => {
  test("nenhum arquivo do motor importa anúncios", () => {
    const dir = join(__dirname);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      expect(readFileSync(join(dir, file), "utf8"), file).not.toMatch(/from\s+["'][^"']*\/(ads|cashback)\//);
    }
  });

  test("selecionar anúncios não altera o veredito nem o hash", () => {
    const before = buildVerdict(input);
    const snapshot = structuredClone(before);
    selectSponsored(before, input.lines);
    expect(before).toEqual(snapshot);
    expect(buildVerdict(input).rankingHash).toBe(snapshot.rankingHash);
  });
});

describe("veredito", () => {
  test("determinístico: mesmo input, mesmo hash", () => {
    expect(buildVerdict(input).rankingHash).toBe(buildVerdict(input).rankingHash);
  });

  test("lista de exemplo gera um veredito com total coerente", () => {
    const v = buildVerdict(input);
    expect(v.primary).not.toBeNull();
    const p = v.primary!;
    expect(p.total).toBeCloseTo(p.basket + p.travel.cost + p.timeCost, 6);
    expect(v.unmatched).toEqual([]);
  });

  test("raio sem lojas devolve veredito vazio", () => {
    const v = buildVerdict({ ...input, origin: { lat: -22.9, lng: -43.2 } });
    expect(v.primary).toBeNull();
    expect(v.storesInRadius).toBe(0);
  });
});

describe("otimizador", () => {
  const stores = new Map([
    ["a", { lat: -23.589, lng: -46.634 }],
    ["b", { lat: -23.59, lng: -46.635 }],
  ]);
  const travel = makeTravel(PILOT_CENTER, stores, "DRIVE");
  const offer = (price: number) => ({
    productId: "p",
    price,
    source: "nfce" as const,
    ageHours: 1,
    observations24h: 2,
    confidence: 0.95,
  });
  const items = [{ id: "x", qty: 1, fallbackPrice: 50 }];

  test("monotonicidade: baixar um preço não piora o total da loja", () => {
    const m = (price: number): Matrix => new Map([["a", new Map([["x", offer(price)]])]]);
    expect(evaluate(["a"], items, m(9), travel).total).toBeLessThan(evaluate(["a"], items, m(10), travel).total);
  });

  test("histerese: economia abaixo do limiar mantém uma loja", () => {
    const plan = (total: number, stores: string[]): Plan =>
      ({
        stores,
        assignments: [],
        basket: 200,
        trip: { order: stores, km: 0, minutes: 0, cost: 0 },
        timeCost: 0,
        missing: 0,
        total,
      }) as Plan;
    expect(chooseVerdict(plan(200, ["a"]), plan(195, ["a", "b"])).primary.stores).toEqual(["a"]);
    expect(chooseVerdict(plan(200, ["a"]), plan(185, ["a", "b"])).primary.stores).toEqual(["a", "b"]);
  });
});
