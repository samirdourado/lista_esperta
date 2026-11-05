/**
 * "2 leite", "leite x3", "3x sabão" → text + quantity.
 * Weights and volumes stay in the text ("arroz 5kg" is one 5 kg pack).
 */
export function parseLine(raw: string): { text: string; quantity: number } {
  const text = raw.replace(/\s+/g, " ").trim();
  const leading = text.match(/^(\d{1,3})\s*(?:x\s*)?(?!\s*(?:kg|g|ml|l|un)\b)(\D.*)$/i);
  if (leading) return { text: leading[2].trim(), quantity: Number(leading[1]) };
  const trailing = text.match(/^(.*\D)\s+x\s*(\d{1,3})$/i);
  if (trailing) return { text: trailing[1].trim(), quantity: Number(trailing[2]) };
  return { text, quantity: 1 };
}

/** Pasted text with one item per line (or comma separated). */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n|,|;/)
    .map((line) => line.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean);
}
