/**
 * Matching rules for the PreçoMelhor directory, run in the browser (D-079).
 * Same rules as back_lista_esperta/src/integrations/precomelhor (pickCandidates)
 * and src/common/text.ts (sizes): keep both in step.
 */

export interface DirectoryProduct {
  ean: string;
  name: string;
  imageUrl: string | null;
  storeCount: number;
}

/** Lowercase, no accents, single spaces: "São  Paulo" → "sao paulo". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "arroz 5kg" → "arroz 5 kg". */
export const spaceSizes = (value: string) => value.replace(/(\d)([a-zA-Z])/g, "$1 $2");

const UNIT: Record<string, "kg" | "g" | "l" | "ml"> = {
  kg: "kg",
  kgs: "kg",
  quilo: "kg",
  quilos: "kg",
  g: "g",
  gr: "g",
  grs: "g",
  gramas: "g",
  l: "l",
  lt: "l",
  lts: "l",
  litro: "l",
  litros: "l",
  ml: "ml",
};
const SIZE = /\b(\d+(?:[.,]\d+)?)\s*(kgs?|quilos?|grs?|gramas|g|lts?|litros?|l|ml)\b/gi;

/** Sizes in grams or millilitres ("1,5 L" → ["v1500"]). */
export function sizesOf(value: string): string[] {
  const plain = value.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return [...plain.matchAll(SIZE)].map(([, amount, rawUnit]) => {
    const n = Number(amount.replace(",", "."));
    const unit = UNIT[rawUnit.toLowerCase()];
    if (unit === "kg") return `m${n * 1000}`;
    if (unit === "g") return `m${n}`;
    if (unit === "l") return `v${n * 1000}`;
    return `v${n}`;
  });
}

/** A typed size must be the product's size: "arroz 1 kg" is not the 5 kg pack. */
export function sameSize(typed: string, productName: string): boolean {
  const wanted = sizesOf(typed);
  if (wanted.length === 0) return true;
  const offered = new Set(sizesOf(productName));
  return wanted.every((size) => offered.has(size));
}

const OTHER_PRODUCT = new Set(
  "condensado doce biscoito bolacha creme achocolatado sobremesa iogurte bebida pudim wafer chocolate bombom".split(
    " ",
  ),
);

/** The products that really are what the person typed (never another kind of product). */
export function pickCandidates(
  text: string,
  products: DirectoryProduct[],
  limit: number,
  exclude: string[] = [],
): DirectoryProduct[] {
  const banned = exclude.map((phrase) => ` ${normalizeText(phrase)} `);
  const typed = spaceSizes(text);
  const wanted = normalizeText(typed)
    .split(" ")
    .filter((word) => word.length > 1 && !/^\d/.test(word));
  if (wanted.length === 0) return [];
  const isMilk = wanted.includes("leite");
  return products
    .flatMap((product) => {
      const spaced = spaceSizes(product.name);
      const words = normalizeText(spaced).split(" ");
      const hasAll = wanted.every((word) => words.some((candidate) => candidate.startsWith(word)));
      const otherKind = words.some(
        (word) => !wanted.includes(word) && (OTHER_PRODUCT.has(word) || (isMilk && word === "po")),
      );
      const padded = ` ${words.join(" ")} `;
      const excluded = banned.some((phrase) => padded.includes(phrase));
      if (!hasAll || otherKind || excluded || !sameSize(typed, spaced)) return [];
      return [{ product, closeness: wanted.length / words.length }];
    })
    .sort(
      (a, b) =>
        Math.round(b.closeness * 10) - Math.round(a.closeness * 10) || b.product.storeCount - a.product.storeCount,
    )
    .slice(0, limit)
    .map(({ product }) => product);
}

/** "-23.5, -46.6" → numbers, or null when the text is not a real point. */
export function parseCoords(value: string | undefined): { lat: number; lng: number } | null {
  const [lat, lng] = (value ?? "").split(",").map((part) => Number(part));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

/** Straight-line distance in km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
