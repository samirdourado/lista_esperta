import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import { ExternalServiceError } from '../integrations/http.js';

const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/** Downloads the public NFC-e page the QR code points to. */
export interface SefazFetcher {
  fetchPage(url: URL): Promise<string>;
}
export const SEFAZ_FETCHER = Symbol('SEFAZ_FETCHER');

@Injectable()
export class HttpSefazFetcher implements SefazFetcher {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async fetchPage(url: URL): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': this.config.get('HTTP_USER_AGENT', { infer: true }),
          Accept: 'text/html',
        },
        // A redirect could leave the allow-listed host.
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new ExternalServiceError(
        'sefaz',
        null,
        error instanceof Error ? error.name : 'network error',
      );
    }
    if (!response.ok)
      throw new ExternalServiceError(
        'sefaz',
        response.status,
        `HTTP ${response.status}`,
      );
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PAGE_BYTES)
      throw new ExternalServiceError(
        'sefaz',
        response.status,
        'page too large',
      );
    return buffer.toString('utf8');
  }
}
