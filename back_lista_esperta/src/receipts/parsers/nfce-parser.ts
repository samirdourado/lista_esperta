import type { ParsedReceipt } from '../receipt.types.js';

/**
 * One strategy per state: each SEFAZ publishes the NFC-e on its own page with
 * its own HTML. Add a file next to sp.parser.ts and register it in index.ts.
 */
export interface NfceParser {
  readonly uf: string;
  /** Hosts allowed for the QR code URL (the API fetches only these: no SSRF). */
  readonly hosts: readonly string[];
  parse(html: string, accessKey: string): ParsedReceipt;
}

export class ReceiptParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReceiptParseError';
  }
}

/** "1.234,56" → 1234.56; "2,000" (quantity) → 2. */
export function brNumber(raw: string | undefined): number {
  const value = (raw ?? '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const number = Number(value);
  if (!Number.isFinite(number))
    throw new ReceiptParseError(`Not a number: "${raw}"`);
  return number;
}
