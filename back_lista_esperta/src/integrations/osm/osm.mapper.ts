import type { PlaceCandidate } from '../../stores/store.types.js';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** shop=* values that are services, not places that sell products. */
const SERVICE_SHOPS = new Set([
  'hairdresser',
  'beauty',
  'massage',
  'tattoo',
  'piercing',
  'laundry',
  'dry_cleaning',
  'car_repair',
  'funeral_directors',
  'travel_agency',
  'estate_agent',
  'money_lender',
  'pawnbroker',
  'bookmaker',
  'lottery',
  'vacant',
  'rental',
  'storage_rental',
  'tailor',
  'shoe_repair',
  'locksmith',
  'insurance',
  'ticket',
]);

/** OSM shop/amenity value → our category slugs (see prisma/seed.ts). */
const CATEGORY_BY_TAG: Record<string, string[]> = {
  supermarket: ['alimentos'],
  convenience: ['alimentos'],
  general: ['alimentos'],
  wholesale: ['alimentos'],
  greengrocer: ['alimentos', 'hortifruti'],
  butcher: ['alimentos', 'acougue'],
  bakery: ['alimentos', 'padaria'],
  pastry: ['alimentos', 'padaria'],
  beverages: ['alimentos', 'bebidas'],
  alcohol: ['alimentos', 'bebidas'],
  dairy: ['alimentos', 'laticinios'],
  deli: ['alimentos', 'mercearia'],
  health_food: ['alimentos', 'mercearia'],
  frozen_food: ['alimentos'],
  seafood: ['alimentos'],
  confectionery: ['alimentos'],
  coffee: ['alimentos', 'mercearia'],
  pharmacy: ['farmacia', 'medicamentos'],
  chemist: ['higiene', 'farmacia'],
  medical_supply: ['farmacia'],
  cosmetics: ['higiene'],
  perfumery: ['higiene'],
  hardware: ['construcao', 'ferramentas'],
  doityourself: ['construcao'],
  trade: ['construcao'],
  building_materials: ['construcao'],
  paint: ['construcao', 'tintas'],
  tiles: ['construcao'],
  bathroom_furnishing: ['construcao'],
  pet: ['pet'],
  stationery: ['papelaria'],
  books: ['papelaria'],
  electronics: ['eletronicos'],
  mobile_phone: ['eletronicos'],
  computer: ['eletronicos'],
  appliance: ['eletrodomesticos'],
  electrical: ['eletrodomesticos'],
  cleaning: ['limpeza'],
  marketplace: ['alimentos', 'hortifruti'],
};

/** "BR-SP" or "SP" → "SP". */
function stateCode(value: string | undefined): string | undefined {
  const match = value?.toUpperCase().match(/(?:^|-)([A-Z]{2})$/);
  return match?.[1];
}

/**
 * Turns an Overpass element into a store candidate, or null when it is not a
 * shop we can compare (no name, no position, or a service like a barber).
 */
export function toPlaceCandidate(
  element: OverpassElement,
): PlaceCandidate | null {
  const tags = element.tags ?? {};
  const name = (tags.name ?? tags.brand)?.trim();
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!name || lat === undefined || lng === undefined) return null;

  const kind = tags.shop ?? tags.amenity;
  if (!kind) return null;
  if (tags.shop && SERVICE_SHOPS.has(tags.shop)) return null;
  if (tags.amenity && !['pharmacy', 'marketplace'].includes(tags.amenity)) {
    return null;
  }

  const address = Object.fromEntries(
    Object.entries({
      street: tags['addr:street'],
      number: tags['addr:housenumber'],
      district: tags['addr:suburb'] ?? tags['addr:neighbourhood'],
      city: tags['addr:city'],
      state: stateCode(tags['addr:state']),
      postcode: tags['addr:postcode'],
    }).filter(([, value]) => value !== undefined && value !== ''),
  );

  return {
    externalId: `${element.type}/${element.id}`,
    name: name.slice(0, 200),
    lat,
    lng,
    address,
    openingHours: tags.opening_hours ? { osm: tags.opening_hours } : undefined,
    categorySlugs: CATEGORY_BY_TAG[kind] ?? [],
  };
}

/** Overpass QL: named shops, pharmacies and street markets inside a bbox. */
export function overpassQuery(
  bbox: { south: number; west: number; north: number; east: number },
  timeoutSeconds: number,
): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:${timeoutSeconds}][bbox:${box}];(nwr["shop"]["name"];nwr["amenity"~"^(pharmacy|marketplace)$"]["name"];);out center tags;`;
}
