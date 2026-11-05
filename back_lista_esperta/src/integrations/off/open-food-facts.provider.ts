import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import type { MeasureUnit } from '../../generated/prisma/enums.js';
import { ExternalServiceError, fetchJson } from '../http.js';

/** A product suggestion found by barcode, to be confirmed by the merchant. */
export interface ProductSuggestion {
  gtin: string;
  name: string;
  brand: string | null;
  unit: MeasureUnit | null;
  unitQuantity: number | null;
  categorySlug: string | null;
  source: 'OPEN_FOOD_FACTS';
}

export interface ProductLookup {
  findByGtin(gtin: string): Promise<ProductSuggestion | null>;
}
export const PRODUCT_LOOKUP = Symbol('PRODUCT_LOOKUP');

interface OffProduct {
  product_name?: string;
  product_name_pt?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  categories_tags?: string[];
}

const UNIT: Record<string, MeasureUnit> = {
  g: 'G',
  kg: 'KG',
  ml: 'ML',
  l: 'L',
  cl: 'ML',
  un: 'UN',
};

/** First matching OFF category tag → our category slug. */
const CATEGORY_RULES: [RegExp, string][] = [
  [/dair|milk|leite|chees|yogurt|iogurte|queijo/, 'laticinios'],
  [
    /beverage|drink|bebida|water|agua|juice|suco|soda|refrigerante|beer|cerveja|wine|vinho/,
    'bebidas',
  ],
  [/bread|bakery|padaria|biscuit|biscoito|cake/, 'padaria'],
  [/meat|carne|sausage|linguica|chicken|frango|fish|peixe/, 'acougue'],
  [/fruit|vegetable|fruta|legume|verdura/, 'hortifruti'],
  [/cleaning|limpeza|detergent|household/, 'limpeza'],
  [
    /hygiene|higiene|shampoo|soap|sabonete|toothpaste|cosmetic|beauty/,
    'higiene',
  ],
  [/pet-food|pet food|dog|cat-food|racao/, 'pet'],
  [/medicine|medicament|pharma/, 'medicamentos'],
  [/./, 'mercearia'],
];

export function categoryFromTags(tags: string[] | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  const text = tags.join(' ').toLowerCase();
  return CATEGORY_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export function toProductSuggestion(
  gtin: string,
  product: OffProduct,
): ProductSuggestion | null {
  const name = (product.product_name_pt || product.product_name)?.trim();
  if (!name) return null;
  const unit =
    UNIT[(product.product_quantity_unit ?? '').toLowerCase()] ?? null;
  const rawQuantity = Number(product.product_quantity);
  const quantity =
    Number.isFinite(rawQuantity) && rawQuantity > 0
      ? (product.product_quantity_unit ?? '').toLowerCase() === 'cl'
        ? rawQuantity * 10
        : rawQuantity
      : null;
  return {
    gtin,
    name: name.slice(0, 200),
    brand: product.brands?.split(',')[0]?.trim() || null,
    unit: quantity ? unit : null,
    unitQuantity: unit ? quantity : null,
    categorySlug: categoryFromTags(product.categories_tags),
    source: 'OPEN_FOOD_FACTS',
  };
}

/** https://openfoodfacts.github.io/openfoodfacts-server/api/ — free, no key. */
@Injectable()
export class OpenFoodFactsLookup implements ProductLookup {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async findByGtin(gtin: string): Promise<ProductSuggestion | null> {
    const fields =
      'product_name,product_name_pt,brands,quantity,product_quantity,product_quantity_unit,categories_tags';
    const { status, body } = await fetchJson<{
      status: number;
      product?: OffProduct;
    }>(
      'openfoodfacts',
      `${this.config.get('OPEN_FOOD_FACTS_URL', { infer: true })}/api/v2/product/${gtin}.json?fields=${fields}`,
      {
        timeoutMs: 10_000,
        userAgent: this.config.get('HTTP_USER_AGENT', { infer: true }),
      },
    );
    if (status === 404) return null;
    if (!body)
      throw new ExternalServiceError('openfoodfacts', status, `HTTP ${status}`);
    return body.status === 1 && body.product
      ? toProductSuggestion(gtin, body.product)
      : null;
  }
}
