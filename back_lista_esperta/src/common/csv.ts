/**
 * Small CSV reader for merchant spreadsheets: handles quotes, escaped quotes,
 * CRLF and both "," and ";" (Excel in pt-BR saves with ";").
 */
export function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>;
  let quoted = false;
  for (const char of headerLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char] += 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return (best[1] > 0 ? best[0] : ',') as ',' | ';' | '\t';
}

export function parseCsv(text: string): string[][] {
  const BOM = String.fromCharCode(0xfeff);
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows.map((cells) => cells.map((cell) => cell.trim()));
}

/** "12,90", "R$ 12.90", "1.234,56" → 12.9 / 1234.56. Null when not a positive price. */
export function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  let value = raw.replace(/[^\d,.-]/g, '');
  if (value.includes(',') && value.includes('.')) {
    // The last separator is the decimal one.
    value =
      value.lastIndexOf(',') > value.lastIndexOf('.')
        ? value.replace(/\./g, '').replace(',', '.')
        : value.replace(/,/g, '');
  } else {
    value = value.replace(',', '.');
  }
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) return null;
  return Math.round(price * 100) / 100;
}

/** "31/12/2026" or "2026-12-31" → end of that day in São Paulo (UTC-3). */
export function parseDay(raw: string | undefined): Date | null {
  if (!raw) return null;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parts = br
    ? [br[3], br[2], br[1]]
    : iso
      ? [iso[1], iso[2], iso[3]]
      : null;
  if (!parts) return null;
  const [y, m, d] = parts;
  const date = new Date(
    `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T23:59:59-03:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}
