/** Grid for anonymous demand counts: 0.01° ≈ 1.1 km. */
export const DEMAND_CELL_DEGREES = 0.01;
/** Cells with fewer lists than this are never shown (k-anonymity, spec section 6). */
export const DEMAND_MIN_LISTS = 10;

export function demandCellKey(lat: number, lng: number): string {
  return `${Math.floor(lat / DEMAND_CELL_DEGREES)}:${Math.floor(lng / DEMAND_CELL_DEGREES)}`;
}

/** The cell of the point and its 8 neighbours (~3 km square around a store). */
export function demandCellsAround(lat: number, lng: number): string[] {
  const row = Math.floor(lat / DEMAND_CELL_DEGREES);
  const col = Math.floor(lng / DEMAND_CELL_DEGREES);
  const keys: string[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) keys.push(`${row + dr}:${col + dc}`);
  }
  return keys;
}
