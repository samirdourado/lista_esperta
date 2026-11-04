export type Category =
  "hortifruti" | "acougue" | "laticinios" | "mercearia" | "bebidas" | "limpeza" | "higiene" | "padaria";

export type StoreFormat = "atacarejo" | "supermercado" | "varejo_bairro" | "hortifruti" | "acougue";

export type PriceSource = "nfce" | "encarte" | "crowd";

export type TravelMode = "DRIVE" | "WALK" | "BICYCLE" | "TRANSIT";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Product {
  id: string;
  brand: string | null;
  name: string;
  basePrice: number;
}

/** Grupo de equivalência: produtos intercambiáveis quando a marca não é exigida. */
export interface ProductGroup {
  key: string;
  label: string;
  category: Category;
  /** "kg" = vendido a peso (quantidade fracionária); "un" = unidade de venda. */
  unit: "kg" | "un";
  /** Todos os termos precisam aparecer (por prefixo) para o match completo. */
  match: string[];
  /** Palavras que sozinhas já identificam o grupo. */
  syn?: string[];
  products: Product[];
}

export interface Store extends LatLng {
  id: string;
  name: string;
  format: StoreFormat;
  address: string;
}

export interface Offer {
  productId: string;
  price: number;
  source: PriceSource;
  ageHours: number;
  observations24h: number;
  confidence: number;
}
