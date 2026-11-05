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
  'filial',
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
