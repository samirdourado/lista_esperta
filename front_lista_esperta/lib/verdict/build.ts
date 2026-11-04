import { offerAt, regionalOffers } from "@/lib/demo/prices";
import { STORES } from "@/lib/demo/stores";
import { distanceM } from "@/lib/geo";
import { parseLine, type ParsedLine } from "@/lib/list/parse";
import type { Category, LatLng, Offer, StoreFormat, TravelMode } from "@/lib/types";
import { badgeFor, levelOf, type Badge, type ConfidenceLevel } from "@/lib/verdict/confidence";
import { sha256 } from "@/lib/verdict/hash";
import { optimize, riskAdjusted, type EngineItem, type Matrix, type Plan } from "@/lib/verdict/optimize";
import { ALGO_VERSION, FALLBACK_FACTOR, MAX_CANDIDATES } from "@/lib/verdict/params";
import { makeTravel } from "@/lib/verdict/travel";

// Monta o veredito a partir da lista. Não importa nada de lib/ads: anúncios são
// escolhidos depois, a partir do veredito pronto (Seção 3.6 do relatório).

export interface ListLine {
  raw: string;
  /** Usuário liberou a marca: aceita o equivalente mais barato. */
  brandUnlocked?: boolean;
}

export interface VerdictInput {
  lines: ListLine[];
  origin: LatLng;
  radiusM: number;
  mode: TravelMode;
}

export interface ItemView {
  line: number;
  raw: string;
  label: string;
  qty: number;
  unit: "kg" | "un";
  category: Category;
  unitPrice: number | null;
  cost: number;
  badge: Badge;
  /** A marca escolhida é um equivalente mais barato que o usuário aceitou. */
  equivalent: boolean;
}

export interface StoreView {
  id: string;
  name: string;
  format: StoreFormat;
  address: string;
  distanceM: number;
  items: ItemView[];
  subtotal: number;
}

export interface PlanView {
  type: "single" | "split";
  stores: StoreView[];
  estimated: ItemView[];
  basket: number;
  travel: { km: number; minutes: number; cost: number };
  timeCost: number;
  total: number;
  routeUrl: string;
}

export interface Verdict {
  verdictId: string;
  algoVersion: string;
  rankingHash: string;
  mode: TravelMode;
  radiusM: number;
  origin: LatLng;
  itemCount: number;
  unmatched: string[];
  storesInRadius: number;
  primary: PlanView | null;
  alternative: PlanView | null;
  splitSaving: number | null;
  splitThreshold: number;
  confidence: { score: number; level: ConfidenceLevel; confirmed: number; priced: number };
}

interface ResolvedItem extends EngineItem {
  line: number;
  parsed: ParsedLine & { group: NonNullable<ParsedLine["group"]> };
  productIds: string[];
}

const p75 = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))];
};

function resolveItems(lines: ListLine[]) {
  const items: ResolvedItem[] = [];
  const unmatched: string[] = [];
  lines.forEach((line, i) => {
    const parsed = parseLine(line.raw);
    if (!parsed.group) {
      unmatched.push(line.raw);
      return;
    }
    const locked = parsed.brandLocked && !line.brandUnlocked && parsed.product;
    const productIds = locked ? [parsed.product!.id] : parsed.group.products.map((p) => p.id);
    const regional = regionalOffers(productIds).map((o) => o.price);
    const reference = regional.length > 0 ? p75(regional) : Math.min(...parsed.group.products.map((p) => p.basePrice));
    items.push({
      id: String(i),
      line: i,
      qty: parsed.qty,
      fallbackPrice: reference * FALLBACK_FACTOR,
      parsed: parsed as ResolvedItem["parsed"],
      productIds,
    });
  });
  return { items, unmatched };
}

function bestOffer(storeId: string, productIds: string[]): Offer | undefined {
  let best: Offer | undefined;
  for (const id of productIds) {
    const o = offerAt(storeId, id);
    if (o && (!best || riskAdjusted(o) < riskAdjusted(best))) best = o;
  }
  return best;
}

const TRAVEL_MODE_PARAM: Record<TravelMode, string> = {
  DRIVE: "driving",
  WALK: "walking",
  BICYCLE: "bicycling",
  TRANSIT: "transit",
};

function routeUrl(origin: LatLng, order: string[], mode: TravelMode) {
  const point = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const stops = order.map((id) => STORES.find((s) => s.id === id)!);
  const params = new URLSearchParams({
    api: "1",
    origin: point(origin),
    destination: point(origin),
    waypoints: stops.map(point).join("|"),
    travelmode: TRAVEL_MODE_PARAM[mode],
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

function toView(plan: Plan, items: ResolvedItem[], input: VerdictInput): PlanView {
  const byId = new Map(items.map((it) => [it.id, it]));
  const itemView = (itemId: string, cost: number, offer: Offer | null): ItemView => {
    const it = byId.get(itemId)!;
    const product = offer ? it.parsed.group.products.find((p) => p.id === offer.productId)! : null;
    return {
      line: it.line,
      raw: it.parsed.raw,
      label: product?.name ?? it.parsed.product?.name ?? it.parsed.group.label,
      qty: it.qty,
      unit: it.parsed.group.unit,
      category: it.parsed.group.category,
      unitPrice: offer?.price ?? null,
      cost,
      badge: badgeFor(offer),
      equivalent: Boolean(it.parsed.product && product && product.id !== it.parsed.product.id),
    };
  };

  const stores: StoreView[] = plan.trip.order.map((storeId) => {
    const store = STORES.find((s) => s.id === storeId)!;
    const storeItems = plan.assignments
      .filter((a) => a.storeId === storeId)
      .map((a) => itemView(a.itemId, a.offer!.price * byId.get(a.itemId)!.qty, a.offer));
    return {
      id: store.id,
      name: store.name,
      format: store.format,
      address: store.address,
      distanceM: distanceM(input.origin, store),
      items: storeItems,
      subtotal: storeItems.reduce((s, i) => s + i.cost, 0),
    };
  });
  const estimated = plan.assignments.filter((a) => a.storeId === null).map((a) => itemView(a.itemId, a.cost, null));
  // O total exibido usa preços observados (o ajuste de risco só serve para escolher o plano).
  const basket = stores.reduce((s, st) => s + st.subtotal, 0) + estimated.reduce((s, i) => s + i.cost, 0);

  return {
    type: stores.length > 1 ? "split" : "single",
    stores,
    estimated,
    basket,
    travel: { km: plan.trip.km, minutes: plan.trip.minutes, cost: plan.trip.cost },
    timeCost: plan.timeCost,
    total: basket + plan.trip.cost + plan.timeCost,
    routeUrl: routeUrl(input.origin, plan.trip.order, input.mode),
  };
}

export function buildVerdict(input: VerdictInput): Verdict {
  const { items, unmatched } = resolveItems(input.lines);

  const inRadius = STORES.filter((s) => distanceM(input.origin, s) <= input.radiusM);
  const matrix: Matrix = new Map(
    inRadius.map((s) => [
      s.id,
      new Map(
        items.flatMap((it) => {
          const o = bestOffer(s.id, it.productIds);
          return o ? [[it.id, o] as const] : [];
        }),
      ),
    ]),
  );

  // Pré-filtro (Seção 2.2): as K lojas que mais cobrem a lista.
  const candidates = [...inRadius]
    .sort(
      (a, b) =>
        matrix.get(b.id)!.size - matrix.get(a.id)!.size || distanceM(input.origin, a) - distanceM(input.origin, b),
    )
    .slice(0, MAX_CANDIDATES)
    .map((s) => s.id);

  const travel = makeTravel(input.origin, new Map(inRadius.map((s) => [s.id, s])), input.mode);
  const decision = optimize(candidates, items, matrix, travel);

  const primary = decision ? toView(decision.primary, items, input) : null;
  const alternative = decision?.alternative ? toView(decision.alternative, items, input) : null;

  let weighted = 0;
  let weight = 0;
  let confirmed = 0;
  for (const a of decision?.primary.assignments ?? []) {
    weight += a.cost;
    weighted += a.cost * (a.offer?.confidence ?? 0);
    if (a.offer && (a.offer.source === "nfce" || a.offer.observations24h >= 3)) confirmed++;
  }
  const score = weight > 0 ? weighted / weight : 0;

  const planKey = (p: Plan | null | undefined) =>
    p && { stores: p.stores, assignments: p.assignments.map((a) => [a.itemId, a.storeId, a.cost]) };
  const rankingHash = sha256({
    algoVersion: ALGO_VERSION,
    lines: input.lines.map((l) => [l.raw.trim().toLowerCase(), Boolean(l.brandUnlocked)]),
    origin: [input.origin.lat.toFixed(4), input.origin.lng.toFixed(4)],
    radiusM: input.radiusM,
    mode: input.mode,
    primary: planKey(decision?.primary),
    alternative: planKey(decision?.alternative),
  });

  return {
    verdictId: `vrd_${rankingHash.slice(7, 17)}`,
    algoVersion: ALGO_VERSION,
    rankingHash,
    mode: input.mode,
    radiusM: input.radiusM,
    origin: input.origin,
    itemCount: input.lines.length,
    unmatched,
    storesInRadius: inRadius.length,
    primary,
    alternative,
    splitSaving: decision?.splitSaving ?? null,
    splitThreshold: decision?.splitThreshold ?? 0,
    confidence: { score, level: levelOf(score), confirmed, priced: items.length },
  };
}
