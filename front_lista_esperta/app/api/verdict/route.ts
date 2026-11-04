import { selectSponsored } from "@/lib/ads/select";
import { DEFAULT_RADIUS_M } from "@/lib/list/query";
import type { TravelMode } from "@/lib/types";
import { buildVerdict } from "@/lib/verdict/build";

// Contrato da tool `quote_basket` (Seção 5.5): agentes recebem o veredito neutro e, à parte,
// as ofertas patrocinadas.

interface Body {
  items?: Array<{ text?: unknown; quantity?: unknown; brand_required?: unknown }>;
  location?: { lat?: unknown; lng?: unknown };
  radius_m?: unknown;
  travel_mode?: unknown;
}

const MODES: TravelMode[] = ["DRIVE", "WALK", "BICYCLE", "TRANSIT"];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const items = Array.isArray(body?.items) ? body.items : [];
  const lat = Number(body?.location?.lat);
  const lng = Number(body?.location?.lng);

  if (items.length === 0 || items.length > 80) {
    return Response.json({ error: "Envie de 1 a 80 itens em items[].text." }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "Envie location.lat e location.lng." }, { status: 400 });
  }

  const lines = items
    .filter((i) => typeof i.text === "string" && i.text.trim())
    .map((i) => {
      const qty = Number(i.quantity);
      const text = (i.text as string).trim();
      return {
        raw: Number.isFinite(qty) && qty > 0 && qty !== 1 ? `${qty} ${text}` : text,
        brandUnlocked: i.brand_required === false,
      };
    });
  const radius = Number(body?.radius_m);
  const mode = MODES.includes(body?.travel_mode as TravelMode) ? (body!.travel_mode as TravelMode) : "DRIVE";

  const verdict = buildVerdict({
    lines,
    origin: { lat, lng },
    radiusM: Number.isFinite(radius) && radius > 0 ? Math.min(radius, 10_000) : DEFAULT_RADIUS_M,
    mode,
  });
  return Response.json({
    ...verdict,
    generated_at: new Date().toISOString(),
    sponsored: selectSponsored(verdict, lines),
  });
}
