import type { Offer } from "@/lib/types";
import type { Travel, Trip } from "@/lib/verdict/travel";
import { RISK_LAMBDA, SPLIT_MIN_ABS, SPLIT_MIN_PCT, STOP_OVERHEAD_MIN, VALUE_PER_MIN } from "@/lib/verdict/params";

// Função pura: não faz I/O e não conhece anúncios (regra de lint em eslint.config.mjs).

export interface EngineItem {
  id: string;
  qty: number;
  fallbackPrice: number;
}

/** storeId → itemId → oferta já resolvida (marca exigida ou equivalente mais barato). */
export type Matrix = Map<string, Map<string, Offer>>;

export interface Assignment {
  itemId: string;
  storeId: string | null; // null = sem preço nessas lojas (estimado)
  cost: number;
  offer: Offer | null;
}

export interface Plan {
  stores: string[];
  assignments: Assignment[];
  basket: number;
  trip: Trip;
  timeCost: number;
  missing: number;
  total: number;
}

export interface Decision {
  primary: Plan;
  alternative: Plan | null;
  splitSaving: number | null;
  splitThreshold: number;
}

export const riskAdjusted = (o: Offer) => o.price * (1 + RISK_LAMBDA * (1 - o.confidence));

function itemCost(item: EngineItem, offer: Offer | undefined) {
  if (!offer) return { cost: item.fallbackPrice * item.qty, covered: false };
  return { cost: riskAdjusted(offer) * item.qty, covered: true };
}

export function evaluate(stores: string[], items: EngineItem[], m: Matrix, travel: Travel): Plan {
  let basket = 0;
  let missing = 0;
  const assignments: Assignment[] = [];
  for (const item of items) {
    let best: Assignment & { covered: boolean } = { itemId: item.id, storeId: null, cost: Infinity, offer: null, covered: false };
    for (const s of stores) {
      const offer = m.get(s)?.get(item.id);
      const c = itemCost(item, offer);
      // Item coberto vence item estimado; entre iguais, o mais barato (empate: ordem das lojas).
      if ((c.covered && !best.covered) || (c.covered === best.covered && c.cost < best.cost)) {
        best = { itemId: item.id, storeId: c.covered ? s : null, cost: c.cost, offer: offer ?? null, covered: c.covered };
      }
    }
    basket += best.cost;
    if (!best.covered) missing++;
    assignments.push({ itemId: best.itemId, storeId: best.storeId, cost: best.cost, offer: best.offer });
  }
  // Uma loja da qual nada é comprado não deveria ser visitada.
  const used = stores.filter((s) => assignments.some((a) => a.storeId === s));
  const visited = used.length > 0 ? used : stores.slice(0, 1);
  const trip = travel(visited);
  const timeCost = (trip.minutes + visited.length * STOP_OVERHEAD_MIN) * VALUE_PER_MIN;
  return { stores: visited, assignments, basket, trip, timeCost, missing, total: basket + trip.cost + timeCost };
}

const byTotal = (a: Plan, b: Plan) => a.total - b.total || a.stores.join().localeCompare(b.stores.join());

export function optimize(candidates: string[], items: EngineItem[], m: Matrix, travel: Travel): Decision | null {
  if (candidates.length === 0 || items.length === 0) return null;
  const singles = candidates.map((s) => evaluate([s], items, m, travel)).sort(byTotal);
  const pairs = candidates
    .flatMap((a, i) => candidates.slice(i + 1).map((b) => evaluate([a, b], items, m, travel)))
    .filter((p) => p.stores.length === 2)
    .sort(byTotal);
  return chooseVerdict(singles[0], pairs[0] ?? null);
}

/** Histerese: só manda dividir quando a economia líquida passa do limiar. */
export function chooseVerdict(single: Plan, pair: Plan | null): Decision {
  const splitThreshold = Math.max(SPLIT_MIN_ABS, SPLIT_MIN_PCT * single.basket);
  if (!pair) return { primary: single, alternative: null, splitSaving: null, splitThreshold };
  const saving = single.total - pair.total;
  return saving >= splitThreshold
    ? { primary: pair, alternative: single, splitSaving: saving, splitThreshold }
    : { primary: single, alternative: pair, splitSaving: saving, splitThreshold };
}
