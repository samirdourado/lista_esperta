import { describe, expect, test } from "vitest";
import { parseLine, splitLines } from "@/lib/list/parse";

describe("parseLine", () => {
  test("quantidade à esquerda e grupo por termos", () => {
    const p = parseLine("2 leite integral");
    expect(p.qty).toBe(2);
    expect(p.group?.key).toBe("leite-integral");
    expect(p.confidence).toBe(1);
    expect(p.brandLocked).toBe(false);
  });

  test("abreviação de cupom e marca exigida", () => {
    const p = parseLine("Lt Itambé Integr. 1L");
    expect(p.group?.key).toBe("leite-integral");
    expect(p.product?.brand).toBe("Itambé");
    expect(p.brandLocked).toBe(true);
  });

  test("peso vira quantidade em itens a granel", () => {
    expect(parseLine("carne moída 500g").qty).toBe(0.5);
    expect(parseLine("1kg contrafilé").qty).toBe(1);
  });

  test("peso descreve a embalagem em itens unitários", () => {
    const p = parseLine("arroz 5kg");
    expect(p.group?.key).toBe("arroz");
    expect(p.qty).toBe(1);
  });

  test("termo curto não casa com palavra maior", () => {
    expect(parseLine("salsicha").group).toBeNull();
    expect(parseLine("sal").group?.key).toBe("sal");
  });

  test("empates: núcleo da frase e termo mais específico vencem", () => {
    expect(parseLine("molho de tomate").group?.key).toBe("molho");
    expect(parseLine("macarrão").group?.key).toBe("macarrao");
    expect(parseLine("maçã").group?.key).toBe("maca");
    expect(parseLine("água sanitária").group?.key).toBe("agua-sanitaria");
    expect(parseLine("pão de forma").group?.key).toBe("pao-forma");
  });

  test("todos os nomes do catálogo voltam para o próprio grupo", async () => {
    const { CATALOG } = await import("@/lib/demo/catalog");
    for (const g of CATALOG) expect(parseLine(g.label).group?.key, g.label).toBe(g.key);
  });

  test("palpite parcial tem confiança menor", () => {
    const p = parseLine("leite");
    expect(p.group?.key).toBe("leite-integral");
    expect(p.confidence).toBeLessThan(1);
  });
});

test("splitLines aceita lista colada do WhatsApp", () => {
  expect(splitLines("- arroz\n• feijão, 1,5 kg batata;café")).toEqual(["arroz", "feijão", "1,5 kg batata", "café"]);
});
