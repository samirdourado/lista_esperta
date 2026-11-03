import { distanceM } from "@/lib/geo";
import type { LatLng, TravelMode } from "@/lib/types";
import { COST_PER_KM, DETOUR_FACTOR, SPEED_KMH, TRANSIT_FARE, TRANSIT_WAIT_MIN } from "@/lib/verdict/params";

export interface Trip {
  /** Ordem de visita das lojas. */
  order: string[];
  km: number;
  minutes: number;
  cost: number;
}

/**
 * Circuito casa → lojas → casa na melhor ordem. Estimativa geodésica × fator de
 * sinuosidade; em produção, substituída pela matriz da Routes API (Seção 2.2).
 */
export function makeTravel(origin: LatLng, stores: Map<string, LatLng>, mode: TravelMode) {
  const cache = new Map<string, Trip>();

  const circuit = (order: string[]): Trip => {
    const points = [origin, ...order.map((id) => stores.get(id)!), origin];
    let meters = 0;
    for (let i = 1; i < points.length; i++) meters += distanceM(points[i - 1], points[i]);
    const km = (meters / 1000) * DETOUR_FACTOR;
    const legs = points.length - 1;
    const minutes = (km / SPEED_KMH[mode]) * 60 + (mode === "TRANSIT" ? legs * TRANSIT_WAIT_MIN : 0);
    const cost = km * COST_PER_KM[mode] + (mode === "TRANSIT" ? 2 * TRANSIT_FARE : 0);
    return { order, km, minutes, cost };
  };

  return (storeIds: string[]): Trip => {
    const key = [...storeIds].sort().join("+");
    const hit = cache.get(key);
    if (hit) return hit;
    const orders = storeIds.length === 2 ? [storeIds, [storeIds[1], storeIds[0]]] : [storeIds];
    const best = orders.map(circuit).reduce((a, b) => (b.km < a.km ? b : a));
    cache.set(key, best);
    return best;
  };
}

export type Travel = ReturnType<typeof makeTravel>;
