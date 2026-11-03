import { CATALOG } from "@/lib/demo/catalog";
import type { Product, ProductGroup } from "@/lib/types";

// Parser determinístico de linhas de lista. Roda no cliente (chips ao vivo) e no servidor
// (veredito), então os dois lados sempre entendem a lista do mesmo jeito.

export interface ParsedLine {
  raw: string;
  qty: number;
  group: ProductGroup | null;
  /** Produto específico quando a linha cita uma marca do grupo. */
  product: Product | null;
  brandLocked: boolean;
  /** 1 = todos os termos do grupo presentes; < 1 = palpite. */
  confidence: number;
}

const ABBREVIATIONS: Record<string, string> = {
  lt: "leite",
  refri: "refrigerante",
  det: "detergente",
  sab: "sabao",
  pap: "papel",
  hig: "higienico",
  int: "integral",
  integr: "integral",
  desn: "desnatado",
  dz: "duzia",
  cx: "caixa",
  pct: "pacote",
  frang: "frango",
  macarr: "macarrao",
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((w) => w.replace(/^[.,]+|[.,]+$/g, ""))
    .filter(Boolean)
    .map((w) => ABBREVIATIONS[w] ?? w);
}

/** Termos curtos ("sal", "po") exigem palavra exata para não casar com "salsicha". */
function termIndex(term: string, words: string[]): number {
  if (term.length <= 3) return words.findIndex((w) => w === term || w === `${term}s`);
  return words.findIndex((w) => w.startsWith(term));
}

const termMatches = (term: string, words: string[]) => termIndex(term, words) >= 0;

interface Candidate {
  group: ProductGroup;
  confidence: number;
  hits: number;
  /** Posição da primeira palavra casada: o núcleo ("molho de tomate") vem antes. */
  position: number;
  /** Comprimento dos termos casados: "macarrao" é mais específico que "maca". */
  specificity: number;
}

function better(a: Candidate, b: Candidate | null): boolean {
  if (!b) return true;
  return (
    a.confidence - b.confidence ||
    a.hits - b.hits ||
    b.position - a.position ||
    a.specificity - b.specificity
  ) > 0;
}

function bestGroup(words: string[]): { group: ProductGroup; confidence: number } | null {
  let best: Candidate | null = null;
  for (const group of CATALOG) {
    const terms = [...group.match, ...(group.syn ?? [])];
    const matched = terms.filter((t) => termMatches(t, words));
    if (matched.length === 0) continue;
    const synHit = group.syn?.some((s) => termMatches(s, words)) ?? false;
    const hits = group.match.filter((t) => termMatches(t, words)).length;
    const candidate: Candidate = {
      group,
      confidence: Math.max(hits / group.match.length, synHit ? 0.9 : 0),
      hits,
      position: Math.min(...matched.map((t) => termIndex(t, words))),
      specificity: matched.reduce((s, t) => s + t.length, 0),
    };
    if (better(candidate, best)) best = candidate;
  }
  return best && { group: best.group, confidence: best.confidence };
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const toNumber = (s: string) => Number(s.replace(",", "."));

export function parseLine(raw: string): ParsedLine {
  let text = normalize(raw);
  let qty = 1;
  let weightKg: number | null = null;

  const weight = text.match(new RegExp(`${NUM}\\s*(kg|g)\\b`));
  if (weight) weightKg = weight[2] === "kg" ? toNumber(weight[1]) : toNumber(weight[1]) / 1000;

  const leading = text.match(new RegExp(`^${NUM}\\s*(x|un|unid|unidades|pacotes?|caixas?|duzias?)?\\s+(?!kg\\b|g\\b)`));
  const trailing = text.match(new RegExp(`\\s(?:x\\s*${NUM}|${NUM}\\s*x)$`));
  if (leading) {
    qty = toNumber(leading[1]);
    text = text.slice(leading[0].length);
  } else if (trailing) {
    qty = toNumber(trailing[1] ?? trailing[2]);
    text = text.slice(0, trailing.index);
  }

  const words = tokenize(text);
  const match = bestGroup(words);
  if (!match) return { raw, qty, group: null, product: null, brandLocked: false, confidence: 0 };

  const { group, confidence } = match;
  // A peso, "500 g de carne" vira 0,5 kg; em itens embalados o peso descreve a embalagem.
  if (group.unit === "kg" && weightKg !== null && !leading) qty = weightKg;

  const product =
    group.products.find((p) => p.brand && termMatches(normalize(p.brand).split(" ")[0], words)) ?? null;

  return { raw, qty: qty > 0 ? qty : 1, group, product, brandLocked: product !== null, confidence };
}

export function splitLines(text: string): string[] {
  return text
    .split(/\n|;|,(?!\d)/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((l) => l.length > 1);
}

export const EXAMPLE_LIST = [
  "arroz 5kg",
  "feijão carioca",
  "2 leite integral",
  "café pilão",
  "óleo de soja",
  "açúcar",
  "macarrão",
  "molho de tomate",
  "1kg contrafilé",
  "carne moída 500g",
  "peito de frango 1kg",
  "banana",
  "tomate",
  "cebola",
  "batata",
  "alface",
  "1 dz ovos",
  "detergente",
  "sabão em pó",
  "papel higiênico",
  "creme dental",
  "pão de forma",
].join("\n");
