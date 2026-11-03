import type { LatLng, Store, StoreFormat } from "@/lib/types";

/** Centro do bairro-piloto (Vila Mariana, São Paulo). */
export const PILOT_CENTER: LatLng = { lat: -23.5893, lng: -46.6345 };
export const PILOT_NAME = "Vila Mariana";
/** Fora deste raio do centro, usamos o bairro-piloto como ponto de partida. */
export const PILOT_COVERAGE_M = 15_000;

// Lojas fictícias com endereços plausíveis do bairro-piloto.
export const STORES: Store[] = [
  { id: "atk-jafet", name: "Atacarejo Ricardo Jafet", format: "atacarejo", lat: -23.5978, lng: -46.6268, address: "Av. Dr. Ricardo Jafet, 1500" },
  { id: "atk-vergueiro", name: "Atacadista Vergueiro", format: "atacarejo", lat: -23.5795, lng: -46.6402, address: "Rua Vergueiro, 2900" },
  { id: "sup-domingos", name: "Supermercado Domingos de Morais", format: "supermercado", lat: -23.5905, lng: -46.6362, address: "R. Domingos de Morais, 1800" },
  { id: "sup-ana-rosa", name: "Supermercado Ana Rosa", format: "supermercado", lat: -23.5812, lng: -46.6378, address: "R. Domingos de Morais, 700" },
  { id: "mer-tavora", name: "Mercadinho Joaquim Távora", format: "varejo_bairro", lat: -23.5862, lng: -46.6312, address: "R. Joaquim Távora, 610" },
  { id: "mer-sena", name: "Mercado Sena Madureira", format: "varejo_bairro", lat: -23.5934, lng: -46.6329, address: "R. Sena Madureira, 1100" },
  { id: "hf-vila", name: "Sacolão da Vila", format: "hortifruti", lat: -23.5880, lng: -46.6372, address: "R. França Pinto, 420" },
  { id: "hf-santa-cruz", name: "Hortifrúti Santa Cruz", format: "hortifruti", lat: -23.5990, lng: -46.6380, address: "R. Santa Cruz, 980" },
  { id: "acg-boi", name: "Açougue Boi da Vila", format: "acougue", lat: -23.5872, lng: -46.6338, address: "R. Cel. Lisboa, 230" },
  { id: "atk-imigrantes", name: "Atacarejo Imigrantes", format: "atacarejo", lat: -23.6170, lng: -46.6282, address: "Rod. dos Imigrantes, km 1" },
];

export const STORE_BY_ID = new Map(STORES.map((s) => [s.id, s]));

export const FORMAT_LABEL: Record<StoreFormat, string> = {
  atacarejo: "Atacarejo",
  supermercado: "Supermercado",
  varejo_bairro: "Mercado de bairro",
  hortifruti: "Hortifrúti",
  acougue: "Açougue",
};
