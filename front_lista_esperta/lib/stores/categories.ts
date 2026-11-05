/** Top-level categories from the seed (back_lista_esperta/prisma/seed.ts). */
export const STORE_CATEGORIES = [
  { slug: "alimentos", label: "Alimentos e mercado" },
  { slug: "limpeza", label: "Limpeza" },
  { slug: "higiene", label: "Higiene e beleza" },
  { slug: "farmacia", label: "Farmácia" },
  { slug: "eletrodomesticos", label: "Eletrodomésticos" },
  { slug: "eletronicos", label: "Eletrônicos" },
  { slug: "construcao", label: "Materiais de construção" },
  { slug: "pet", label: "Pet shop" },
  { slug: "papelaria", label: "Papelaria" },
] as const;

const SUB_LABEL: Record<string, string> = {
  mercearia: "Mercearia",
  laticinios: "Laticínios",
  hortifruti: "Hortifrúti",
  acougue: "Açougue",
  padaria: "Padaria",
  bebidas: "Bebidas",
  medicamentos: "Medicamentos",
  "cuidados-pessoais": "Cuidados pessoais",
  ferramentas: "Ferramentas",
  tintas: "Tintas",
};

/** Label for a slug, falling back to the slug itself. */
export function categoryLabel(slug: string): string {
  return STORE_CATEGORIES.find((c) => c.slug === slug)?.label ?? SUB_LABEL[slug] ?? slug;
}

/** The most specific label of a store, e.g. ["alimentos","padaria"] → "Padaria". */
export function storeKind(categories: string[]): string | null {
  const sub = categories.find((slug) => slug in SUB_LABEL);
  if (sub) return SUB_LABEL[sub];
  return categories[0] ? categoryLabel(categories[0]) : null;
}
