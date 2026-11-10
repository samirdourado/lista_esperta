import type { Point } from "@/lib/location/use-location";
import type { ShoppingListItem } from "@/lib/shopping-lists/repository";
import { genericFor, matchQueries, searchPhrases, type GenericProduct } from "@/lib/catalog/generic-products";
import { distanceKm, median, parseCoords, pickCandidates, type DirectoryProduct } from "./match";

/**
 * PreçoMelhor, read from the person's browser (D-079): its public API allows
 * it (CORS open, ~60 requests a minute per IP), while its Cloudflare blocks
 * our server. Our API checks everything sent from here before using it.
 */
const BASE = "https://www.precomelhor.com.br";
/** Only what the comparison can use leaves the browser. */
const REGION_KM = 50;
const FRESH_DAYS = 30;
/** Brands compared per generic item: each store keeps its cheapest one. */
const TYPED_CANDIDATES = 5;
const CONCURRENCY = 4;

export interface DirectoryStorePrice {
  storeId: string;
  storeName: string;
  lat: number;
  lng: number;
  price: number;
  observedAt: string;
}

export interface DirectoryProductPrices {
  ean: string;
  name: string;
  imageUrl: string | null;
  nationalMedian?: number;
  prices: DirectoryStorePrice[];
}

/** The `directory` field of POST /verdict. */
export interface DirectoryItem {
  index: number;
  products: DirectoryProductPrices[];
}

const cache = new Map<string, Promise<unknown>>();
let running = 0;
const waiting: (() => void)[] = [];

async function limited<T>(run: () => Promise<T>): Promise<T> {
  if (running >= CONCURRENCY) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await run();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

function getJson<T>(path: string): Promise<T | null> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T | null>;
  const request = limited(async () => {
    const response = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`PreçoMelhor HTTP ${response.status}`);
    return (await response.json()) as T;
  });
  cache.set(path, request);
  // A failure is not remembered: the next screen tries again.
  request.catch(() => cache.delete(path));
  return request;
}

export async function searchProducts(query: string): Promise<DirectoryProduct[]> {
  const body = await getJson<{
    items?: { ean?: string; product_name?: string; image_url?: string | null; store_count?: number }[];
  }>(`/api/search?q=${encodeURIComponent(query.trim())}`);
  return (body?.items ?? []).flatMap((item) =>
    item.ean && item.product_name
      ? [
          {
            ean: item.ean,
            name: item.product_name,
            imageUrl: item.image_url ?? null,
            storeCount: item.store_count ?? 0,
          },
        ]
      : [],
  );
}

/** One product with its store prices near `origin`, and its median in the country. */
export async function productPrices(ean: string, origin: Point | null): Promise<DirectoryProductPrices | null> {
  const body = await getJson<{
    product?: { product_name?: string; image_url?: string | null };
    prices?: {
      store_id?: number | string;
      store_name?: string;
      store_coords?: string;
      price?: number;
      promo_price?: number | null;
      update_date?: string;
    }[];
  }>(`/api/product/${ean}`);
  if (!body?.product?.product_name) return null;
  const since = Date.now() - FRESH_DAYS * 86_400_000;
  const all = (body.prices ?? []).flatMap((row) => {
    const point = parseCoords(row.store_coords);
    const price = Number(row.promo_price ?? row.price);
    const observed = new Date(row.update_date ?? "");
    if (!point || row.store_id === undefined || !row.store_name || !(price > 0)) return [];
    if (Number.isNaN(observed.getTime()) || observed.getTime() < since) return [];
    return [
      {
        storeId: String(row.store_id),
        storeName: row.store_name.slice(0, 160),
        ...point,
        price,
        observedAt: observed.toISOString(),
      },
    ];
  });
  return {
    ean,
    name: body.product.product_name.slice(0, 300),
    imageUrl: body.product.image_url ?? null,
    nationalMedian: median(all.map((row) => row.price)),
    prices: (origin ? all.filter((row) => distanceKm(origin, row) <= REGION_KM) : all).slice(0, 300),
  };
}

/**
 * Brands for a list item: each search phrase in turn until one finds
 * products that match (the directory's search ranks by popularity and
 * returns only 24 results).
 */
async function candidatesFor(text: string, generic: GenericProduct | undefined): Promise<DirectoryProduct[]> {
  const queries = generic ? matchQueries(generic) : [text];
  for (const phrase of generic ? searchPhrases(generic) : [text]) {
    const found = await searchProducts(phrase);
    const picked = new Map<string, DirectoryProduct>();
    for (const query of queries)
      for (const product of pickCandidates(query, found, TYPED_CANDIDATES, generic?.exclude))
        picked.set(product.ean, product);
    if (picked.size > 0) return [...picked.values()].slice(0, TYPED_CANDIDATES);
  }
  return [];
}

/** For each item of the list: the barcode picked, or the brands matching what was typed. */
export async function readDirectory(items: ShoppingListItem[], origin: Point): Promise<DirectoryItem[]> {
  const results = await Promise.all(
    items.slice(0, 100).map(async (item, index): Promise<DirectoryItem> => {
      try {
        // A catalog product is searched by its generic words (D-080).
        const generic = genericFor(item.freeText);
        const eans = item.webPrice?.ean
          ? [item.webPrice.ean]
          : (await candidatesFor(item.freeText, generic)).map((p) => p.ean);
        const products = await Promise.all(eans.map((ean) => productPrices(ean, origin).catch(() => null)));
        return { index, products: products.filter((p): p is DirectoryProductPrices => p !== null) };
      } catch {
        return { index, products: [] };
      }
    }),
  );
  return results.filter((item) => item.products.length > 0);
}
