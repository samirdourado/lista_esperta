/** "12,90" / "12.90" / "R$ 1.234,56" → number; null when not a positive amount. */
export function parseMoney(raw: string): number | null {
  let value = raw.replace(/[^\d,.]/g, "");
  if (!value) return null;
  if (value.includes(",") && value.includes(".")) {
    value =
      value.lastIndexOf(",") > value.lastIndexOf(".")
        ? value.replace(/\./g, "").replace(",", ".")
        : value.replace(/,/g, "");
  } else {
    value = value.replace(",", ".");
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

/** 12.9 → "12,90" for inputs. */
export function moneyInput(value: number | null): string {
  return value === null ? "" : value.toFixed(2).replace(".", ",");
}
