import type { MeasureUnit } from "./queries";

export const UNIT_LABEL: Record<MeasureUnit, string> = {
  UN: "unidade",
  G: "g",
  KG: "kg",
  ML: "ml",
  L: "litro",
  M: "metro",
  M2: "m²",
};

export const UNIT_OPTIONS: { value: MeasureUnit; label: string }[] = [
  { value: "UN", label: "Unidades (un)" },
  { value: "G", label: "Gramas (g)" },
  { value: "KG", label: "Quilos (kg)" },
  { value: "ML", label: "Mililitros (ml)" },
  { value: "L", label: "Litros (l)" },
  { value: "M", label: "Metros (m)" },
  { value: "M2", label: "Metros quadrados (m²)" },
];

/** "500 g", "2 litros", "12 unidades". */
export function packLabel(unit: MeasureUnit, quantity: number): string {
  const amount = quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  if (unit === "UN") return `${amount} ${quantity === 1 ? "unidade" : "unidades"}`;
  if (unit === "L") return `${amount} ${quantity === 1 ? "litro" : "litros"}`;
  if (unit === "M") return `${amount} ${quantity === 1 ? "metro" : "metros"}`;
  return `${amount} ${UNIT_LABEL[unit]}`;
}

/** Messages for ImportReport error codes (back: prices.dto.ts). */
export const IMPORT_ERROR: Record<string, string> = {
  MISSING_PRICE: "preço ausente ou inválido",
  INVALID_GTIN: "código de barras inválido",
  PRODUCT_NOT_FOUND: "produto não encontrado: informe categoria, unidade e quantidade para cadastrá-lo",
  INVALID_DATE: "data da oferta inválida (use dd/mm/aaaa, até 90 dias à frente)",
  UNKNOWN_CATEGORY: "categoria desconhecida",
  INVALID_UNIT: "unidade ou quantidade inválida",
  LOOKUP_LIMIT: "limite de 50 buscas por código nesta planilha; envie o restante em outro arquivo",
};

/** Example spreadsheet offered for download on the import page. */
export const CSV_TEMPLATE = [
  "codigo;nome;preco;oferta ate;categoria;unidade;quantidade",
  "7891000100103;;8,49;;;;",
  ";Arroz branco tipo 1 5 kg;27,90;;mercearia;KG;5",
  ";Detergente líquido 500 ml;2,49;31/12/2026;limpeza;ML;500",
].join("\r\n");
