/** Lowercase, no accents, single spaces: "São  Paulo" → "sao paulo". */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Words that say nothing about which business it is. */
const COMPANY_NOISE = new Set([
  'ltda',
  'me',
  'epp',
  'eireli',
  'sa',
  's',
  'a',
  'cia',
  'comercio',
  'comercial',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'industria',
  'servicos',
  'loja',
  'lojas',
  'filial',
  // Kinds of shop: two different shops can both be a "supermercado".
  'supermercado',
  'supermercados',
  'mercado',
  'mercados',
  'mercadinho',
  'minimercado',
  'hipermercado',
  'atacado',
  'atacadista',
  'atacarejo',
  'drogaria',
  'drogarias',
  'farmacia',
  'farmacias',
  'padaria',
  'panificadora',
  'hortifruti',
  'distribuidora',
  'magazine',
  'emporio',
]);

function tokens(value: string | null | undefined): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((word) => word.length > 1 && !COMPANY_NOISE.has(word)),
  );
}

/**
 * How much two business names share, from 0 to 1: the share of the shorter
 * name's meaningful words found in the other ("Mercado Bom Preço" vs
 * "BOM PRECO SUPERMERCADOS LTDA" → 0.5).
 */
export function nameSimilarity(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  const [small, large] =
    left.size <= right.size ? [left, right] : [right, left];
  let shared = 0;
  for (const word of small) if (large.has(word)) shared += 1;
  return shared / small.size;
}

const UNIT_ALIASES: Record<string, string> = {
  kg: 'kg',
  kgs: 'kg',
  quilo: 'kg',
  quilos: 'kg',
  g: 'g',
  gr: 'g',
  grs: 'g',
  gramas: 'g',
  l: 'l',
  lt: 'l',
  lts: 'l',
  litro: 'l',
  litros: 'l',
  ml: 'ml',
};
const SIZE =
  /\b(\d+(?:[.,]\d+)?)\s*(kgs?|quilos?|grs?|gramas|g|lts?|litros?|l|ml)\b/gi;

/** "arroz 5kg" → "arroz 5 kg": trigram search sees the size as its own word. */
export function spaceSizes(value: string): string {
  return value.replace(/(\d)([a-zA-Z])/g, '$1 $2');
}

/** Sizes written in a text, in grams or millilitres ("1,5 L" → ["v1500"]). */
export function sizesOf(value: string): string[] {
  const sizes: string[] = [];
  const plain = value.normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [, amount, rawUnit] of plain.matchAll(SIZE)) {
    const unit = UNIT_ALIASES[rawUnit.toLowerCase()];
    const n = Number(amount.replace(',', '.'));
    if (unit === 'kg') sizes.push(`m${n * 1000}`);
    else if (unit === 'g') sizes.push(`m${n}`);
    else if (unit === 'l') sizes.push(`v${n * 1000}`);
    else sizes.push(`v${n}`);
  }
  return sizes;
}

/** A typed size must be the product's size: "arroz 1 kg" is not the 5 kg pack. */
export function sameSize(typed: string, productName: string): boolean {
  const wanted = sizesOf(typed);
  if (wanted.length === 0) return true;
  const offered = new Set(sizesOf(productName));
  return wanted.every((size) => offered.has(size));
}
