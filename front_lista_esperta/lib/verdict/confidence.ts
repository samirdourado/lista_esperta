import type { Offer } from "@/lib/types";

export type BadgeTone = "confirmed" | "advertised" | "community" | "estimated";

export interface Badge {
  tone: BadgeTone;
  text: string;
}

export function relativeAge(hours: number): string {
  if (hours < 1) return "há menos de 1 h";
  if (hours < 24) return `há ${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

const people = (n: number) => (n === 1 ? "1 pessoa" : `${n} pessoas`);

/** Selo de procedência da Seção 4.4. */
export function badgeFor(offer: Offer | null): Badge {
  if (!offer) return { tone: "estimated", text: "Estimativa da região" };
  if (offer.source === "nfce" || offer.observations24h >= 3) {
    const n = Math.max(offer.observations24h, 1);
    return { tone: "confirmed", text: `Pago por ${people(n)}, ${relativeAge(offer.ageHours)}` };
  }
  if (offer.source === "encarte") return { tone: "advertised", text: `Encarte, visto ${relativeAge(offer.ageHours)}` };
  return { tone: "community", text: `Visto por ${people(offer.observations24h)}, ${relativeAge(offer.ageHours)}` };
}

export type ConfidenceLevel = "alta" | "média" | "baixa";

export function levelOf(score: number): ConfidenceLevel {
  return score >= 0.8 ? "alta" : score >= 0.6 ? "média" : "baixa";
}
