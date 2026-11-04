import { CATALOG } from "@/lib/demo/catalog";
import { STORES } from "@/lib/demo/stores";
import { seeded } from "@/lib/geo";
import type { Category, Offer, PriceSource, Product, Store, StoreFormat } from "@/lib/types";

// Base simulada que imita o "current_prices" da Seção 1.4: uma observação vigente por
// (loja, produto), com fonte, idade e confiança. Determinística para a demo ser reprodutível.

type ByCategory = Partial<Record<Category, number>> & { default: number };

const PRICE_FACTOR: Record<StoreFormat, ByCategory> = {
  atacarejo: { default: 0.86, laticinios: 0.9, hortifruti: 1.06, acougue: 0.97, padaria: 1.0 },
  supermercado: { default: 1.0, hortifruti: 1.02 },
  varejo_bairro: { default: 1.09, hortifruti: 0.97, acougue: 1.02 },
  hortifruti: { default: 1.05, hortifruti: 0.8, padaria: 0.95 },
  acougue: { default: 1.0, acougue: 0.84 },
};

/** Probabilidade de a loja vender itens da categoria. */
const CARRIES: Record<StoreFormat, ByCategory> = {
  atacarejo: { default: 0.95, hortifruti: 0.6, acougue: 0.7, padaria: 0.5 },
  supermercado: { default: 0.95 },
  varejo_bairro: { default: 0.75, hortifruti: 0.7, acougue: 0.4 },
  hortifruti: { default: 0, hortifruti: 1, laticinios: 0.4, padaria: 0.5 },
  acougue: { default: 0, acougue: 1 },
};

/** Probabilidade de termos um preço observado para um item que a loja vende. */
const OBSERVED = 0.93;
const BRAND_CARRIED = 0.75;

const HALF_LIFE_H: Record<PriceSource, number> = { nfce: 72, encarte: 240, crowd: 24 };
const BASE_TRUST: Record<PriceSource, number> = { nfce: 0.95, encarte: 0.6, crowd: 0.3 };

const pick = (t: ByCategory, c: Category) => t[c] ?? t.default;
const roundPrice = (p: number) => Math.max(0.49, Math.floor(p * 10) / 10 + 0.09);

export function confidenceOf(source: PriceSource, ageHours: number, observations24h: number): number {
  const base = source === "crowd" ? Math.min(0.3 + 0.15 * observations24h, 0.75) : BASE_TRUST[source];
  return Math.max(0.15, base * 0.5 ** (ageHours / HALF_LIFE_H[source]));
}

function simulateOffer(store: Store, product: Product, category: Category, multiBrand: boolean): Offer | null {
  const r = (salt: string) => seeded(`${store.id}|${product.id}|${salt}`);
  if (seeded(`${store.id}|${category}|${product.id.split(":")[0]}`) >= pick(CARRIES[store.format], category))
    return null;
  if (multiBrand && r("brand") >= BRAND_CARRIED) return null;
  if (r("observed") >= OBSERVED) return null;

  const promo = r("promo") < 0.12;
  let price = product.basePrice * pick(PRICE_FACTOR[store.format], category) * (0.93 + 0.14 * r("noise"));
  if (promo) price *= 0.82;

  const s = r("source");
  // Bairro-piloto semeado com NFC-e antes da abertura (Seção 4.3): a nota fiscal domina.
  const source: PriceSource = promo ? "encarte" : s < 0.65 ? "nfce" : s < 0.85 ? "encarte" : "crowd";
  const age = r("age");
  const ageHours = source === "nfce" ? 1 + age * 30 : source === "encarte" ? 6 + age * 60 : 0.5 + age * 12;
  const obs = r("obs");
  const observations24h =
    source === "nfce"
      ? ageHours < 24
        ? 1 + Math.floor(obs * 5)
        : 0
      : source === "crowd"
        ? 1 + Math.floor(obs * 2)
        : 0;

  return {
    productId: product.id,
    price: roundPrice(price),
    source,
    ageHours: Math.round(ageHours * 10) / 10,
    observations24h,
    confidence: confidenceOf(source, ageHours, observations24h),
  };
}

const OFFERS = new Map<string, Map<string, Offer>>();
for (const store of STORES) {
  const byProduct = new Map<string, Offer>();
  for (const group of CATALOG) {
    for (const product of group.products) {
      const offer = simulateOffer(store, product, group.category, group.products.length > 1);
      if (offer) byProduct.set(product.id, offer);
    }
  }
  OFFERS.set(store.id, byProduct);
}

export function offerAt(storeId: string, productId: string): Offer | undefined {
  return OFFERS.get(storeId)?.get(productId);
}

/** Todas as ofertas de um produto na região (para a mediana/p75 regional). */
export function regionalOffers(productIds: string[]): Offer[] {
  const out: Offer[] = [];
  for (const byProduct of OFFERS.values()) {
    for (const id of productIds) {
      const o = byProduct.get(id);
      if (o) out.push(o);
    }
  }
  return out;
}
