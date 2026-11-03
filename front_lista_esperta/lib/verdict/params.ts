import type { TravelMode } from "@/lib/types";

// Parâmetros públicos do algoritmo (exibidos em /transparencia). Hipóteses iniciais da
// Seção 2.1 do relatório; calibrar com dados reais.

export const ALGO_VERSION = "2026.11.0";

export const VALUE_PER_MIN = 0.25; // R$ 15/h
export const STOP_OVERHEAD_MIN = 12; // estacionar, fila, caixa
export const DETOUR_FACTOR = 1.35; // distância em linha reta → distância de rua
export const RISK_LAMBDA = 0.1; // preço pouco confiável fica até 10 % "mais caro"
export const FALLBACK_FACTOR = 1.15; // item sem preço na loja: p75 regional × 1,15
export const SPLIT_MIN_ABS = 10; // R$
export const SPLIT_MIN_PCT = 0.04; // da cesta
export const MAX_CANDIDATES = 10;

export const COST_PER_KM: Record<TravelMode, number> = { DRIVE: 0.85, WALK: 0, BICYCLE: 0, TRANSIT: 0 };
export const SPEED_KMH: Record<TravelMode, number> = { DRIVE: 22, WALK: 4.8, BICYCLE: 14, TRANSIT: 15 };
export const TRANSIT_FARE = 5; // por trecho; ida e volta = 2 tarifas
export const TRANSIT_WAIT_MIN = 8; // por trecho

export const MODE_LABEL: Record<TravelMode, string> = {
  DRIVE: "Carro",
  WALK: "A pé",
  BICYCLE: "Bicicleta",
  TRANSIT: "Ônibus/metrô",
};
