import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { ExternalServiceError } from '../http.js';

export interface ScrapedPage {
  markdown: string;
  title: string | null;
  /** Final URL after redirects. */
  url: string;
}

/** Reads a public page (or PDF) as text. Firecrawl today (spec: FLYER source). */
export interface FlyerScraper {
  readonly enabled: boolean;
  scrape(url: string): Promise<ScrapedPage>;
}
export const FLYER_SCRAPER = Symbol('FLYER_SCRAPER');

interface ScrapeResponse {
  success?: boolean;
  error?: string;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string | string[];
      url?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  };
}

/** POST /v2/scrape (docs.firecrawl.dev). Flyers are often PDFs: parsed too. */
@Injectable()
export class FirecrawlService implements FlyerScraper {
  private readonly logger = new Logger(FirecrawlService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return Boolean(this.config.get('FIRECRAWL_API_KEY', { infer: true }));
  }

  async scrape(url: string): Promise<ScrapedPage> {
    const key = this.config.get('FIRECRAWL_API_KEY', { infer: true });
    if (!key)
      throw new ExternalServiceError(
        'firecrawl',
        null,
        'FIRECRAWL_API_KEY is not set',
      );
    const base = this.config.get('FIRECRAWL_URL', { infer: true });
    let response: Response;
    try {
      response = await fetch(`${base}/v2/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 60_000,
          parsers: [{ type: 'pdf', maxPages: 20 }],
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      throw new ExternalServiceError(
        'firecrawl',
        null,
        error instanceof Error ? error.name : 'network error',
      );
    }
    const body = (await response
      .json()
      .catch(() => null)) as ScrapeResponse | null;
    if (!response.ok || !body?.success) {
      this.logger.warn(`Firecrawl answered HTTP ${response.status}`);
      throw new ExternalServiceError(
        'firecrawl',
        response.status,
        body?.error ?? `HTTP ${response.status}`,
      );
    }
    const metadata = body.data?.metadata;
    const title = Array.isArray(metadata?.title)
      ? (metadata.title[0] ?? null)
      : (metadata?.title ?? null);
    return {
      markdown: body.data?.markdown ?? '',
      title,
      url: metadata?.url ?? metadata?.sourceURL ?? url,
    };
  }
}
