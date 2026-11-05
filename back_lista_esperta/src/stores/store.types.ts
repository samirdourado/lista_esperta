/** Shape of `stores.address` (JSON). Every field is optional: sources differ. */
export interface StoreAddress {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  /** Two-letter state code, e.g. "SP". */
  state?: string;
  postcode?: string;
}

export interface TimeRange {
  /** "08:00" */
  open: string;
  /** "20:00"; a close earlier than open crosses midnight. */
  close: string;
}

export const WEEK_DAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

/**
 * Shape of `stores.opening_hours` (JSON):
 * - `weekly`: filled in by the merchant;
 * - `osm`: raw OpenStreetMap opening_hours string, parsed later (phase 7).
 */
export interface OpeningHours {
  weekly?: Partial<Record<WeekDay, TimeRange[]>>;
  osm?: string;
}

/** A shop found by a places provider, before it becomes a Store row. */
export interface PlaceCandidate {
  /** Provider-scoped id, e.g. "node/123". */
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  address: StoreAddress;
  openingHours?: OpeningHours;
  categorySlugs: string[];
}
