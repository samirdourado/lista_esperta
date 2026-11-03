import { CATALOG, CATEGORY_LABEL } from "@/lib/demo/catalog";
import { offerAt } from "@/lib/demo/prices";
import { PILOT_CENTER, STORE_BY_ID, STORES } from "@/lib/demo/stores";
import { distanceM, seeded } from "@/lib/geo";
import type { Category, LatLng } from "@/lib/types";
import { buildVerdict } from "@/lib/verdict/build";

// Painel do lojista (Seção 3.4) sobre listas simuladas do bairro-piloto.

export const SIMULATED_LISTS = 1200;
export const NEARBY_M = 2000;
export const K_ANONYMITY = 20;
const GRID = 5;
const CELL_M = 600;
const M_PER_DEG_LAT = 111_320;

interface SimList {
  origin: LatLng;
  groups: string[];
}

function offset(center: LatLng, northM: number, eastM: number): LatLng {
  return {
    lat: center.lat + northM / M_PER_DEG_LAT,
    lng: center.lng + eastM / (M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180)),
  };
}

function simulateLists(): SimList[] {
  return Array.from({ length: SIMULATED_LISTS }, (_, n) => {
    const angle = 2 * Math.PI * seeded(`list${n}|a`);
    const dist = 2200 * Math.sqrt(seeded(`list${n}|d`));
    const origin = offset(PILOT_CENTER, dist * Math.cos(angle), dist * Math.sin(angle));
    const groups = CATALOG.filter((g) => seeded(`list${n}|${g.key}`) < 0.33).map((g) => g.key);
    return { origin, groups };
  });
}

export interface StoreInsights {
  storeId: string;
  storeName: string;
  listsNearby: number;
  wins: number;
  demand: Array<{ category: Category; label: string; lists: number }>;
  losses: Array<{ label: string; mine: number; best: number; bestStore: string }>;
  cells: Array<{ row: number; col: number; lists: number }>;
}

export function storeInsights(storeId: string): StoreInsights | null {
  const store = STORE_BY_ID.get(storeId);
  if (!store) return null;

  const lists = simulateLists();
  const nearby = lists.filter((l) => distanceM(l.origin, store) <= NEARBY_M);

  let wins = 0;
  for (const l of nearby) {
    const lines = l.groups.map((key) => ({ raw: CATALOG.find((g) => g.key === key)!.label }));
    const v = buildVerdict({ lines, origin: l.origin, radiusM: 3000, mode: "DRIVE" });
    if (v.primary?.stores.some((s) => s.id === storeId)) wins++;
  }

  const counts = new Map<Category, number>();
  for (const l of nearby) {
    const cats = new Set(l.groups.map((key) => CATALOG.find((g) => g.key === key)!.category));
    for (const c of cats) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const demand = [...counts]
    .map(([category, n]) => ({ category, label: CATEGORY_LABEL[category], lists: n }))
    .sort((a, b) => b.lists - a.lists);

  const rivals = STORES.filter((s) => s.id !== storeId && distanceM(s, store) <= NEARBY_M);
  const losses = CATALOG.flatMap((g) =>
    g.products.flatMap((p) => {
      const mine = offerAt(storeId, p.id);
      if (!mine) return [];
      const best = rivals
        .map((r) => ({ r, o: offerAt(r.id, p.id) }))
        .filter((x) => x.o)
        .sort((a, b) => a.o!.price - b.o!.price)[0];
      if (!best || best.o!.price >= mine.price) return [];
      return [{ label: p.name, mine: mine.price, best: best.o!.price, bestStore: best.r.name }];
    }),
  )
    .sort((a, b) => b.mine - b.best - (a.mine - a.best))
    .slice(0, 5);

  const half = (GRID * CELL_M) / 2;
  const cells = Array.from({ length: GRID * GRID }, (_, i) => ({ row: Math.floor(i / GRID), col: i % GRID, lists: 0 }));
  for (const l of lists) {
    const north = (l.origin.lat - store.lat) * M_PER_DEG_LAT;
    const east = (l.origin.lng - store.lng) * M_PER_DEG_LAT * Math.cos((store.lat * Math.PI) / 180);
    const row = Math.floor((half - north) / CELL_M);
    const col = Math.floor((east + half) / CELL_M);
    if (row >= 0 && row < GRID && col >= 0 && col < GRID) cells[row * GRID + col].lists++;
  }

  return { storeId, storeName: store.name, listsNearby: nearby.length, wins, demand, losses, cells };
}

export const HEATMAP = { grid: GRID, cellM: CELL_M };
