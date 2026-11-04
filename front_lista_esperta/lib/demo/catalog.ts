import type { ProductGroup } from "@/lib/types";

// Catálogo canônico do bairro-piloto. Preços-base são de referência para a simulação,
// não cotações reais.
const g = (
  key: string,
  label: string,
  category: ProductGroup["category"],
  unit: ProductGroup["unit"],
  match: string[],
  products: Array<[brand: string | null, base: number]>,
  syn?: string[],
): ProductGroup => ({
  key,
  label,
  category,
  unit,
  match,
  syn,
  products: products.map(([brand, base], i) => ({
    id: `${key}:${i}`,
    brand,
    name: brand ? `${label} ${brand}` : label,
    basePrice: base,
  })),
});

export const CATALOG: ProductGroup[] = [
  // Hortifrúti
  g("banana", "Banana prata", "hortifruti", "kg", ["banana"], [[null, 6.99]]),
  g("tomate", "Tomate", "hortifruti", "kg", ["tomate"], [[null, 8.49]]),
  g("cebola", "Cebola", "hortifruti", "kg", ["cebola"], [[null, 5.99]]),
  g("batata", "Batata", "hortifruti", "kg", ["batata"], [[null, 6.49]]),
  g("cenoura", "Cenoura", "hortifruti", "kg", ["cenoura"], [[null, 5.49]]),
  g("maca", "Maçã gala", "hortifruti", "kg", ["maca"], [[null, 10.9]]),
  g("laranja", "Laranja pera", "hortifruti", "kg", ["laranja"], [[null, 4.99]]),
  g("limao", "Limão tahiti", "hortifruti", "kg", ["limao"], [[null, 6.9]]),
  g("alface", "Alface crespa", "hortifruti", "un", ["alface"], [[null, 3.49]]),
  g("alho", "Alho 200 g", "hortifruti", "un", ["alho"], [[null, 6.9]]),
  g("ovos", "Ovos brancos (dúzia)", "hortifruti", "un", ["ovo"], [[null, 13.9]]),

  // Açougue
  g("carne-moida", "Carne moída (patinho)", "acougue", "kg", ["carne", "moid"], [[null, 42.9]], ["patinho"]),
  g("contrafile", "Contrafilé", "acougue", "kg", ["contrafile"], [[null, 64.9]], ["bife", "contra"]),
  g("peito-frango", "Peito de frango", "acougue", "kg", ["frango", "peito"], [[null, 21.9]]),
  g("sobrecoxa", "Sobrecoxa de frango", "acougue", "kg", ["sobrecoxa"], [[null, 16.9]], ["coxa"]),
  g("linguica", "Linguiça toscana", "acougue", "kg", ["linguica"], [[null, 24.9]]),

  // Laticínios
  g(
    "leite-integral",
    "Leite UHT integral 1 L",
    "laticinios",
    "un",
    ["leite", "integral"],
    [
      ["Itambé", 5.99],
      ["Piracanjuba", 5.79],
      ["Italac", 5.49],
    ],
  ),
  g(
    "leite-desnatado",
    "Leite UHT desnatado 1 L",
    "laticinios",
    "un",
    ["leite", "desnat"],
    [
      ["Itambé", 6.19],
      ["Piracanjuba", 5.99],
    ],
  ),
  g(
    "manteiga",
    "Manteiga com sal 200 g",
    "laticinios",
    "un",
    ["manteiga"],
    [
      ["Aviação", 16.9],
      ["Itambé", 14.9],
    ],
  ),
  g(
    "requeijao",
    "Requeijão cremoso 200 g",
    "laticinios",
    "un",
    ["requeijao"],
    [
      ["Catupiry", 12.9],
      ["Itambé", 8.9],
    ],
  ),
  g("mussarela", "Mussarela fatiada 150 g", "laticinios", "un", ["mussarela"], [[null, 9.9]], ["queijo"]),
  g(
    "iogurte",
    "Iogurte natural 170 g",
    "laticinios",
    "un",
    ["iogurte"],
    [
      ["Nestlé", 3.69],
      ["Batavo", 3.39],
    ],
  ),

  // Mercearia
  g(
    "arroz",
    "Arroz branco 5 kg",
    "mercearia",
    "un",
    ["arroz"],
    [
      ["Camil", 28.9],
      ["Tio João", 31.9],
      ["Prato Fino", 33.9],
    ],
  ),
  g(
    "feijao",
    "Feijão carioca 1 kg",
    "mercearia",
    "un",
    ["feijao"],
    [
      ["Camil", 8.49],
      ["Kicaldo", 8.99],
    ],
  ),
  g(
    "macarrao",
    "Macarrão espaguete 500 g",
    "mercearia",
    "un",
    ["macarrao"],
    [
      ["Renata", 4.99],
      ["Barilla", 8.49],
    ],
    ["espaguete"],
  ),
  g(
    "oleo",
    "Óleo de soja 900 ml",
    "mercearia",
    "un",
    ["oleo"],
    [
      ["Liza", 7.49],
      ["Soya", 7.29],
    ],
  ),
  g(
    "acucar",
    "Açúcar refinado 1 kg",
    "mercearia",
    "un",
    ["acucar"],
    [
      ["União", 4.99],
      ["Caravelas", 4.59],
    ],
  ),
  g(
    "cafe",
    "Café torrado e moído 500 g",
    "mercearia",
    "un",
    ["cafe"],
    [
      ["Pilão", 21.9],
      ["Melitta", 20.9],
      ["3 Corações", 19.9],
    ],
  ),
  g("farinha", "Farinha de trigo 1 kg", "mercearia", "un", ["farinha"], [["Dona Benta", 5.49]]),
  g(
    "molho",
    "Molho de tomate 340 g",
    "mercearia",
    "un",
    ["molho"],
    [
      ["Quero", 2.99],
      ["Pomarola", 3.49],
    ],
  ),
  g("sal", "Sal refinado 1 kg", "mercearia", "un", ["sal"], [[null, 2.49]]),
  g(
    "achocolatado",
    "Achocolatado em pó 400 g",
    "mercearia",
    "un",
    ["achocolatado"],
    [
      ["Nescau", 10.9],
      ["Toddy", 9.9],
    ],
    ["nescau", "toddy"],
  ),

  // Bebidas
  g(
    "refri-cola",
    "Refrigerante de cola 2 L",
    "bebidas",
    "un",
    ["refrigerante"],
    [
      ["Coca-Cola", 11.99],
      ["Pepsi", 9.99],
    ],
    ["coca", "pepsi"],
  ),
  g("agua", "Água mineral 1,5 L", "bebidas", "un", ["agua", "mineral"], [[null, 2.99]]),

  // Limpeza
  g(
    "detergente",
    "Detergente 500 ml",
    "limpeza",
    "un",
    ["detergente"],
    [
      ["Ypê", 2.69],
      ["Limpol", 2.49],
    ],
  ),
  g(
    "sabao-po",
    "Sabão em pó 800 g",
    "limpeza",
    "un",
    ["sabao", "po"],
    [
      ["Omo", 17.9],
      ["Brilhante", 13.4],
      ["Tixan", 11.9],
    ],
  ),
  g(
    "amaciante",
    "Amaciante 2 L",
    "limpeza",
    "un",
    ["amaciante"],
    [
      ["Comfort", 19.9],
      ["Ypê", 14.9],
    ],
  ),
  g("agua-sanitaria", "Água sanitária 2 L", "limpeza", "un", ["sanitaria"], [[null, 6.49]], ["cloro", "qboa"]),

  // Higiene
  g(
    "papel-higienico",
    "Papel higiênico 12 rolos",
    "higiene",
    "un",
    ["papel", "higien"],
    [
      ["Neve", 24.9],
      ["Personal", 18.9],
    ],
  ),
  g(
    "creme-dental",
    "Creme dental 90 g",
    "higiene",
    "un",
    ["creme", "dental"],
    [
      ["Colgate", 4.99],
      ["Sorriso", 3.99],
    ],
    ["pasta"],
  ),
  g(
    "sabonete",
    "Sabonete 85 g",
    "higiene",
    "un",
    ["sabonete"],
    [
      ["Dove", 4.29],
      ["Lux", 2.39],
    ],
  ),

  // Padaria
  g("pao-frances", "Pão francês", "padaria", "kg", ["pao", "frances"], [[null, 16.9]]),
  g(
    "pao-forma",
    "Pão de forma 500 g",
    "padaria",
    "un",
    ["pao", "forma"],
    [
      ["Pullman", 9.49],
      ["Wickbold", 10.9],
    ],
  ),
];

export const GROUP_BY_KEY = new Map(CATALOG.map((grp) => [grp.key, grp]));
export const PRODUCT_BY_ID = new Map(CATALOG.flatMap((grp) => grp.products.map((p) => [p.id, p] as const)));

export const CATEGORY_LABEL: Record<ProductGroup["category"], string> = {
  hortifruti: "Hortifrúti",
  acougue: "Açougue",
  laticinios: "Laticínios",
  mercearia: "Mercearia",
  bebidas: "Bebidas",
  limpeza: "Limpeza",
  higiene: "Higiene",
  padaria: "Padaria",
};
