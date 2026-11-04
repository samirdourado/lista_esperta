import { STORE_BY_ID } from "@/lib/demo/stores";
import { distanceM } from "@/lib/geo";
import { parseLine } from "@/lib/list/parse";
import type { ListLine, Verdict } from "@/lib/verdict/build";

// Anúncios só leem o veredito pronto; o motor nunca lê anúncios.

interface Campaign {
  id: string;
  storeId: string;
  groupKey: string;
  maxCpc: number;
  offer: string;
}

const CAMPAIGNS: Campaign[] = [
  {
    id: "cmp-cafe-tavora",
    storeId: "mer-tavora",
    groupKey: "cafe",
    maxCpc: 0.9,
    offer: "Café 3 Corações 500 g por R$ 17,90",
  },
  {
    id: "cmp-arroz-anarosa",
    storeId: "sup-ana-rosa",
    groupKey: "arroz",
    maxCpc: 1.2,
    offer: "Arroz Camil 5 kg por R$ 25,90",
  },
  {
    id: "cmp-sabao-anarosa",
    storeId: "sup-ana-rosa",
    groupKey: "sabao-po",
    maxCpc: 0.7,
    offer: "Sabão em pó Tixan 800 g por R$ 10,49",
  },
  {
    id: "cmp-leite-sena",
    storeId: "mer-sena",
    groupKey: "leite-integral",
    maxCpc: 0.5,
    offer: "Leite integral Italac 1 L por R$ 4,99",
  },
  { id: "cmp-carne-boi", storeId: "acg-boi", groupKey: "contrafile", maxCpc: 1.5, offer: "Contrafilé a R$ 54,90 o kg" },
];

export interface Sponsored {
  campaignId: string;
  storeName: string;
  offer: string;
  distanceM: number;
}

export function selectSponsored(verdict: Verdict, lines: ListLine[], limit = 2): Sponsored[] {
  const groups = new Set(lines.map((l) => parseLine(l.raw).group?.key).filter(Boolean));
  const inVerdict = new Set(verdict.primary?.stores.map((s) => s.id));
  return CAMPAIGNS.filter((c) => groups.has(c.groupKey) && !inVerdict.has(c.storeId))
    .map((c) => {
      const store = STORE_BY_ID.get(c.storeId)!;
      return { c, store, d: distanceM(verdict.origin, store) };
    })
    .filter(({ d }) => d <= verdict.radiusM)
    .sort((a, b) => b.c.maxCpc - a.c.maxCpc)
    .slice(0, limit)
    .map(({ c, store, d }) => ({ campaignId: c.id, storeName: store.name, offer: c.offer, distanceM: d }));
}
