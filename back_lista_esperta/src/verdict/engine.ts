/**
 * Decision engine (spec section 7). Pure functions, no I/O.
 *
 *   totalCost(store) = Σ price(item, store) × qty
 *                    + Σ regional median × qty   (items the store lacks)
 *
 * The cheapest basket nearby wins; distance only breaks ties (D-069).
 *
 * NEUTRALITY: this file knows nothing about sponsorship. Its inputs are
 * prices and distances, and nothing else can
 * change the order. Enforced by ESLint (no imports from ../sponsored) and by
 * verdict.spec.ts.
 */

export interface EngineItem {
  index: number;
  productId: string | null;
  quantity: number;
}

export interface EnginePrice {
  price: number;
}

export interface EngineStore {
  id: string;
  /** One way, from the person to the store. */
  km: number;
  minutes: number;
  prices: Map<string, EnginePrice>;
}

export interface Leg {
  km: number;
  minutes: number;
}

export interface EngineParams {
  /** Only suggest two stores when they save more than this (R$)… */
  splitMinSavings: number;
  /** …and more than this share of the best single store. */
  splitMinShare: number;
  /** Pairs are searched among the N best single stores (spec: N ≤ 8). */
  splitCandidates: number;
}

export interface StoreTotals {
  storeId: string;
  itemsCost: number;
  missingPenalty: number;
  travelKm: number;
  travelMinutes: number;
  totalCost: number;
  found: number;
  /** Items with a price somewhere nearby (the denominator of "X de Y"). */
  priced: number;
  missing: number[];
}

export interface SplitPlan {
  storeIds: [string, string];
  /** Item index → store id. */
  assignment: Record<number, string>;
  itemsCost: number;
  missingPenalty: number;
  travelKm: number;
  travelMinutes: number;
  totalCost: number;
  savings: number;
}

export interface EngineResult {
  ranking: StoreTotals[];
  split: SplitPlan | null;
  /** Regional median per product (used for missing items). */
  medians: Map<string, number>;
  /** Items no store nearby has a price for. */
  unpriced: number[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function regionalMedians(
  items: EngineItem[],
  stores: EngineStore[],
): Map<string, number> {
  const medians = new Map<string, number>();
  for (const item of items) {
    if (!item.productId || medians.has(item.productId)) continue;
    const prices = stores.flatMap((store) => {
      const found = store.prices.get(item.productId!);
      return found ? [found.price] : [];
    });
    if (prices.length > 0) medians.set(item.productId, median(prices));
  }
  return medians;
}

/** One store: round trip, every priced item bought there or penalized. */
export function storeTotals(
  store: EngineStore,
  items: EngineItem[],
  medians: Map<string, number>,
): StoreTotals {
  let itemsCost = 0;
  let missingPenalty = 0;
  let found = 0;
  let priced = 0;
  const missing: number[] = [];
  for (const item of items) {
    if (!item.productId || !medians.has(item.productId)) continue;
    priced += 1;
    const price = store.prices.get(item.productId);
    if (price) {
      itemsCost += price.price * item.quantity;
      found += 1;
    } else {
      missingPenalty += medians.get(item.productId)! * item.quantity;
      missing.push(item.index);
    }
  }
  const travelKm = store.km * 2;
  const travelMinutes = store.minutes * 2;
  return {
    storeId: store.id,
    itemsCost: round2(itemsCost),
    missingPenalty: round2(missingPenalty),
    travelKm: round2(travelKm),
    travelMinutes: Math.round(travelMinutes),
    totalCost: round2(itemsCost + missingPenalty),
    found,
    priced,
    missing,
  };
}

/** Two stops: origin → A → B → origin; each item goes to the cheaper of the pair. */
export function pairTotals(
  a: EngineStore,
  b: EngineStore,
  between: Leg,
  items: EngineItem[],
  medians: Map<string, number>,
): Omit<SplitPlan, 'savings'> {
  let itemsCost = 0;
  let missingPenalty = 0;
  const assignment: Record<number, string> = {};
  for (const item of items) {
    if (!item.productId || !medians.has(item.productId)) continue;
    const pa = a.prices.get(item.productId)?.price;
    const pb = b.prices.get(item.productId)?.price;
    if (pa === undefined && pb === undefined) {
      missingPenalty += medians.get(item.productId)! * item.quantity;
      continue;
    }
    const useA = pb === undefined || (pa !== undefined && pa <= pb);
    itemsCost += (useA ? pa! : pb) * item.quantity;
    assignment[item.index] = useA ? a.id : b.id;
  }
  // Visit the closer store first: the route is the same length either way.
  const travelKm = a.km + between.km + b.km;
  const travelMinutes = a.minutes + between.minutes + b.minutes;
  return {
    storeIds: a.km <= b.km ? [a.id, b.id] : [b.id, a.id],
    assignment,
    itemsCost: round2(itemsCost),
    missingPenalty: round2(missingPenalty),
    travelKm: round2(travelKm),
    travelMinutes: Math.round(travelMinutes),
    totalCost: round2(itemsCost + missingPenalty),
  };
}

/** Order: lowest total cost, then more items found, then closer, then id (stable). */
function compareTotals(
  x: StoreTotals,
  y: StoreTotals,
  stores: Map<string, EngineStore>,
): number {
  return (
    x.totalCost - y.totalCost ||
    y.found - x.found ||
    stores.get(x.storeId)!.km - stores.get(y.storeId)!.km ||
    x.storeId.localeCompare(y.storeId)
  );
}

export function computeVerdict(
  items: EngineItem[],
  stores: EngineStore[],
  between: (a: string, b: string) => Leg,
  params: EngineParams,
): EngineResult {
  const medians = regionalMedians(items, stores);
  const unpriced = items
    .filter((item) => !item.productId || !medians.has(item.productId))
    .map((item) => item.index);
  const byId = new Map(stores.map((store) => [store.id, store]));
  const ranking = stores
    .map((store) => storeTotals(store, items, medians))
    // A store with none of the items is no answer.
    .filter((totals) => totals.found > 0)
    .sort((x, y) => compareTotals(x, y, byId));

  let split: SplitPlan | null = null;
  const best = ranking[0];
  if (best) {
    const candidates = ranking.slice(0, Math.min(params.splitCandidates, 8));
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const a = byId.get(candidates[i].storeId)!;
        const b = byId.get(candidates[j].storeId)!;
        const pair = pairTotals(a, b, between(a.id, b.id), items, medians);
        // Both stores must be used, otherwise it is not a split.
        const used = new Set(Object.values(pair.assignment));
        if (used.size < 2) continue;
        const savings = round2(best.totalCost - pair.totalCost);
        if (!split || pair.totalCost < split.totalCost)
          split = { ...pair, savings };
      }
    }
    if (
      split &&
      !(
        split.savings > params.splitMinSavings &&
        split.savings / best.totalCost > params.splitMinShare
      )
    ) {
      split = null;
    }
  }
  return { ranking, split, medians, unpriced };
}
