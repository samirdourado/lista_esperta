import { normalizeText } from "@/lib/directory/match";

/**
 * The list is built from generic products (D-080): "Arroz branco 5 kg", not a
 * brand. When the person asks where to buy, each one is looked up in the
 * stores by `query`, and each store answers with its cheapest matching brand.
 *
 * - `query`: words every product name must contain, plus the size ("arroz 5kg").
 *   Several when the stores name it in different ways.
 * - `exclude`: words or phrases that mean another product ("integral" is not
 *   white rice, "com gas" is not still water).
 * - `search`: what to type in the directory's search, tried in order. Its search
 *   mostly looks at the first word, so some products need a better phrase.
 */
export interface GenericProduct {
  id: string;
  label: string;
  query: string | string[];
  exclude?: string[];
  search?: string[];
}

export interface ProductCategory {
  id: string;
  label: string;
  products: GenericProduct[];
}

const p = (
  id: string,
  label: string,
  query: string | string[],
  exclude?: string[],
  search?: string[],
): GenericProduct => ({
  id,
  label,
  query,
  ...(exclude ? { exclude } : {}),
  ...(search ? { search } : {}),
});

/** Words that every product name must contain, for each way of naming it. */
export const matchQueries = (product: GenericProduct): string[] =>
  Array.isArray(product.query) ? product.query : [product.query];

/** What to type in the directory search, in order. */
export const searchPhrases = (product: GenericProduct): string[] => product.search ?? matchQueries(product).slice(0, 1);

const WHITE_RICE = ["integral", "parboilizado", "arboreo", "japones", "cateto", "negro", "7"];
const GROUND_COFFEE = ["soluvel", "capsula", "capsulas", "cappuccino", "descafeinado"];
const STILL_WATER = ["com gas", "c gas", "gaseificada", "saborizada", "tonica"];
const SPARKLING = ["sem gas", "s g", "s gas"];
const STILL_SEARCH = ["agua mineral", "agua sem gas"];
const SPARKLING_SEARCH = ["agua com gas", "agua mineral com gas"];

export const CATEGORIES: ProductCategory[] = [
  {
    id: "mercearia",
    label: "Mercearia",
    products: [
      p("arroz-branco-1kg", "Arroz branco 1 kg", "arroz 1kg", WHITE_RICE),
      p("arroz-branco-5kg", "Arroz branco 5 kg", "arroz 5kg", WHITE_RICE),
      p("arroz-integral-1kg", "Arroz integral 1 kg", "arroz integral 1kg"),
      p("arroz-parboilizado-5kg", "Arroz parboilizado 5 kg", "arroz parbo 5kg", undefined, [
        "parbolizado 5kg",
        "arroz parboilizado 5kg",
      ]),
      p("feijao-carioca-1kg", "Feijão carioca 1 kg", "feijao carioca 1kg"),
      p("feijao-preto-1kg", "Feijão preto 1 kg", "feijao preto 1kg"),
      p("acucar-refinado-1kg", "Açúcar refinado 1 kg", "acucar refinado 1kg"),
      p("acucar-cristal-5kg", "Açúcar cristal 5 kg", "acucar cristal 5kg"),
      p("sal-1kg", "Sal refinado 1 kg", "sal 1kg", ["grosso", "rosa", "light"], ["sal refinado"]),
      p("oleo-soja-900ml", "Óleo de soja 900 ml", "oleo soja 900ml"),
      p("azeite-500ml", "Azeite de oliva 500 ml", "azeite 500ml"),
      p("macarrao-espaguete-500g", "Macarrão espaguete 500 g", "macarrao espaguete 500g"),
      p("macarrao-parafuso-500g", "Macarrão parafuso 500 g", "macarrao parafuso 500g"),
      p("farinha-trigo-1kg", "Farinha de trigo 1 kg", "farinha trigo 1kg"),
      p("molho-tomate-340g", "Molho de tomate 340 g", "molho tomate 340g"),
      p("extrato-tomate-140g", "Extrato de tomate 140 g", "extrato tomate 140g"),
    ],
  },
  {
    id: "cafe-matinal",
    label: "Café da manhã",
    products: [
      p("cafe-po-250g", "Café em pó 250 g", "cafe 250g", GROUND_COFFEE),
      p("cafe-po-500g", "Café em pó 500 g", "cafe 500g", GROUND_COFFEE),
      p(
        "cafe-soluvel-100g",
        "Café solúvel 100 g",
        ["cafe soluvel 100g", "nescafe 100g"],
        ["capsula"],
        ["nescafe tradicao", "cafe soluvel"],
      ),
      p(
        "cafe-soluvel-200g",
        "Café solúvel 200 g",
        ["cafe soluvel 200g", "nescafe 200g"],
        ["capsula"],
        ["nescafe tradicao", "cafe soluvel"],
      ),
      p("achocolatado-400g", "Achocolatado em pó 400 g", "achocolatado 400g"),
      p("biscoito-agua-sal", "Biscoito água e sal", "biscoito agua sal"),
      p("biscoito-recheado", "Biscoito recheado", "biscoito recheado"),
      p("pao-forma", "Pão de forma", "pao forma"),
    ],
  },
  {
    id: "laticinios",
    label: "Leite e frios",
    products: [
      p("leite-integral-1l", "Leite integral 1 L", "leite integral 1l"),
      p("leite-desnatado-1l", "Leite desnatado 1 L", "leite desnatado 1l"),
      p("leite-semidesnatado-1l", "Leite semidesnatado 1 L", "leite semidesnatado 1l"),
      p("leite-condensado-395g", "Leite condensado 395 g", "leite condensado 395g"),
      p("creme-leite-200g", "Creme de leite 200 g", "creme leite 200g"),
      p("manteiga-200g", "Manteiga 200 g", "manteiga 200g"),
      p("margarina-500g", "Margarina 500 g", "margarina 500g"),
      p("requeijao-200g", "Requeijão 200 g", "requeijao 200g"),
      p("iogurte-natural-170g", "Iogurte natural 170 g", "iogurte natural 170g"),
    ],
  },
  {
    id: "bebidas",
    label: "Bebidas",
    products: [
      p("agua-300ml", "Água mineral 300 ml", "agua 300ml", STILL_WATER, STILL_SEARCH),
      p("agua-500ml", "Água mineral 500 ml", "agua 500ml", STILL_WATER, STILL_SEARCH),
      p("agua-1-5l", "Água mineral 1,5 L", "agua 1,5l", STILL_WATER, STILL_SEARCH),
      p("agua-5l", "Água mineral 5 L", "agua 5l", STILL_WATER, STILL_SEARCH),
      p("agua-gas-300ml", "Água com gás 300 ml", "agua gas 300ml", SPARKLING, SPARKLING_SEARCH),
      p("agua-gas-500ml", "Água com gás 500 ml", "agua gas 500ml", SPARKLING, SPARKLING_SEARCH),
      p("agua-gas-1-5l", "Água com gás 1,5 L", "agua gas 1,5l", SPARKLING, SPARKLING_SEARCH),
      p("refrigerante-cola-2l", "Refrigerante de cola 2 L", "refrigerante cola 2l", ["zero", "sem acucar"]),
      p(
        "refrigerante-cola-zero-2l",
        "Refrigerante de cola zero 2 L",
        ["refrigerante cola zero 2l", "coca cola sem acucar 2l"],
        undefined,
        ["refrigerante zero 2l", "coca cola sem acucar"],
      ),
      p("refrigerante-guarana-2l", "Refrigerante guaraná 2 L", "refrigerante guarana 2l", ["zero"]),
      p("suco-uva-1l", "Suco de uva integral 1 L", "suco uva integral 1l", undefined, ["suco uva integral"]),
      p("cerveja-lata-350ml", "Cerveja lata 350 ml", "cerveja 350ml", ["sem", "zero"]),
    ],
  },
  {
    id: "limpeza",
    label: "Limpeza",
    products: [
      p("detergente-500ml", "Detergente 500 ml", "detergente 500ml"),
      p("sabao-po-1kg", "Sabão em pó 1 kg", "sabao po 1kg", undefined, ["sabao em po"]),
      p("sabao-liquido-3l", "Sabão líquido 3 L", "sabao liquido 3l"),
      p("amaciante-2l", "Amaciante 2 L", "amaciante 2l"),
      p("agua-sanitaria-2l", "Água sanitária 2 L", "agua sanitaria 2l"),
      p("desinfetante-2l", "Desinfetante 2 L", "desinfetante 2l"),
      p("esponja", "Esponja de louça", "esponja"),
      p("saco-lixo-50l", "Saco de lixo 50 L", "saco lixo 50l"),
    ],
  },
  {
    id: "higiene",
    label: "Higiene",
    products: [
      p("papel-higienico", "Papel higiênico", "papel higienico"),
      p("creme-dental-90g", "Creme dental 90 g", "creme dental 90g"),
      p("sabonete-85g", "Sabonete 85 g", "sabonete 85g", ["liquido"]),
      p("shampoo-350ml", "Shampoo 350 ml", "shampoo 350ml"),
      p("condicionador-350ml", "Condicionador 350 ml", "condicionador 350ml"),
      p("desodorante-aerosol", "Desodorante aerosol", "desodorante aerosol"),
      p("absorvente", "Absorvente", "absorvente"),
    ],
  },
];

export const ALL_PRODUCTS: GenericProduct[] = CATEGORIES.flatMap((category) => category.products);

const BY_LABEL = new Map(ALL_PRODUCTS.map((product) => [normalizeText(product.label), product]));

/** The generic product behind a list item, when it came from the catalog. */
export function genericFor(label: string): GenericProduct | undefined {
  return BY_LABEL.get(normalizeText(label));
}

/** Autocomplete: every typed word starts a word of the name, accents ignored. */
export function searchCatalog(text: string, products: GenericProduct[] = ALL_PRODUCTS): GenericProduct[] {
  const words = normalizeText(text).split(" ").filter(Boolean);
  if (words.length === 0) return products;
  return products.filter((product) => {
    const name = normalizeText(product.label).split(" ");
    return words.every((word) => name.some((part) => part.startsWith(word)));
  });
}
