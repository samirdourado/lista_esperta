const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DEC1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const DEC3 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export const brl = (n: number) => BRL.format(n).replace(/ /g, " ");

/** "R$ 287,35" → { int: "287", cents: "35" } para a etiqueta de preço. */
export function splitBrl(n: number) {
  const fixed = Math.abs(n).toFixed(2);
  const [int, cents] = fixed.split(".");
  return { int: Number(int).toLocaleString("pt-BR"), cents };
}

/** Valor por extenso para leitores de tela: "287 reais e 35 centavos". */
export function brlSpoken(n: number) {
  const { int, cents } = splitBrl(n);
  return cents === "00" ? `${int} reais` : `${int} reais e ${Number(cents)} centavos`;
}

export const km = (n: number) => `${DEC1.format(n)} km`;
export const meters = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : km(m / 1000));
export const minutes = (n: number) => (n < 60 ? `${Math.round(n)} min` : `${Math.floor(n / 60)} h ${Math.round(n % 60)} min`);

export function qtyLabel(qty: number, unit: "kg" | "un") {
  if (unit === "kg") return qty < 1 ? `${Math.round(qty * 1000)} g` : `${DEC3.format(qty)} kg`;
  return qty === 1 ? "" : `${DEC1.format(qty)}×`;
}
