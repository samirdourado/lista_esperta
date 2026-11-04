import { PILOT_CENTER } from "@/lib/demo/stores";
import type { LatLng, TravelMode } from "@/lib/types";
import type { ListLine } from "@/lib/verdict/build";

// A URL do veredito carrega a lista inteira: dá para compartilhar, recarregar e recalcular
// exatamente o mesmo resultado (base da verificação por ranking_hash).

export interface VerdictQuery {
  lines: ListLine[];
  origin: LatLng;
  radiusM: number;
  mode: TravelMode;
  /** Ponto de partida é o centro do bairro-piloto, não a localização do usuário. */
  pilot: boolean;
  ads: boolean;
}

const MODES: TravelMode[] = ["DRIVE", "WALK", "BICYCLE", "TRANSIT"];
export const RADIUS_OPTIONS_M = [1000, 2000, 3000, 5000];
export const DEFAULT_RADIUS_M = 3000;

export function toSearchParams(q: VerdictQuery): URLSearchParams {
  const sp = new URLSearchParams();
  q.lines.forEach((l) => sp.append("i", l.raw));
  const unlocked = q.lines.flatMap((l, i) => (l.brandUnlocked ? [i] : []));
  if (unlocked.length) sp.set("sm", unlocked.join(","));
  sp.set("lat", q.origin.lat.toFixed(5));
  sp.set("lng", q.origin.lng.toFixed(5));
  sp.set("r", String(q.radiusM));
  sp.set("m", q.mode);
  if (q.pilot) sp.set("piloto", "1");
  if (!q.ads) sp.set("anuncios", "0");
  return sp;
}

type RawParams = Record<string, string | string[] | undefined>;

const all = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const one = (v: string | string[] | undefined) => all(v)[0];

export function fromSearchParams(sp: RawParams): VerdictQuery | null {
  const raws = all(sp.i)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 80);
  if (raws.length === 0) return null;
  const unlocked = new Set((one(sp.sm) ?? "").split(",").filter(Boolean).map(Number));
  const lat = Number(one(sp.lat));
  const lng = Number(one(sp.lng));
  const validOrigin = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const radius = Number(one(sp.r));
  const mode = one(sp.m) as TravelMode;
  return {
    lines: raws.map((raw, i) => ({ raw, brandUnlocked: unlocked.has(i) })),
    origin: validOrigin ? { lat, lng } : PILOT_CENTER,
    radiusM: RADIUS_OPTIONS_M.includes(radius) ? radius : DEFAULT_RADIUS_M,
    mode: MODES.includes(mode) ? mode : "DRIVE",
    pilot: one(sp.piloto) === "1" || !validOrigin,
    ads: one(sp.anuncios) !== "0",
  };
}

export function verdictHref(q: VerdictQuery): string {
  return `/verdict?${toSearchParams(q)}`;
}

export function editHref(q: VerdictQuery): string {
  const sp = new URLSearchParams();
  q.lines.forEach((l) => sp.append("i", l.raw));
  sp.set("r", String(q.radiusM));
  sp.set("m", q.mode);
  return `/?${sp}`;
}
