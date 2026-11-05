import type { NfceParser } from './nfce-parser.js';
import { SpNfceParser } from './sp.parser.js';

/** Supported states. Start: São Paulo (spec section 6). */
const PARSERS: NfceParser[] = [new SpNfceParser()];

export function parserForUf(uf: string): NfceParser | undefined {
  return PARSERS.find((parser) => parser.uf === uf);
}

export function supportedUfs(): string[] {
  return PARSERS.map((parser) => parser.uf);
}
