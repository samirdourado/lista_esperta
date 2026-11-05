/** Grid used to cache store discovery: 0.05° ≈ 5.5 km in latitude. */
export const CELL_DEGREES = 0.05;
const KM_PER_DEGREE_LAT = 111.32;

export interface Cell {
  key: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

function cellAt(row: number, col: number): Cell {
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return {
    key: `${row}:${col}`,
    south: round(row * CELL_DEGREES),
    west: round(col * CELL_DEGREES),
    north: round((row + 1) * CELL_DEGREES),
    east: round((col + 1) * CELL_DEGREES),
  };
}

export function cellFromKey(key: string): Cell {
  const [row, col] = key.split(':').map(Number);
  return cellAt(row, col);
}

/**
 * Every cell that overlaps the circle's bounding box, the one with the
 * center first so the closest shops show up before the rest.
 */
export function cellsForCircle(
  lat: number,
  lng: number,
  radiusKm: number,
): Cell[] {
  const dLat = radiusKm / KM_PER_DEGREE_LAT;
  const dLng =
    radiusKm /
    (KM_PER_DEGREE_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const rowOf = (value: number) => Math.floor(value / CELL_DEGREES);
  const center = { row: rowOf(lat), col: rowOf(lng) };
  const cells: Cell[] = [];
  for (let row = rowOf(lat - dLat); row <= rowOf(lat + dLat); row += 1) {
    for (let col = rowOf(lng - dLng); col <= rowOf(lng + dLng); col += 1) {
      cells.push(cellAt(row, col));
    }
  }
  const distance = (cell: Cell) => {
    const [row, col] = cell.key.split(':').map(Number);
    return Math.abs(row - center.row) + Math.abs(col - center.col);
  };
  return cells.sort((a, b) => distance(a) - distance(b));
}
