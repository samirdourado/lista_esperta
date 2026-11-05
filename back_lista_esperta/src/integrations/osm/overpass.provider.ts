import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cell } from '../../common/geo-cell.js';
import type { Env } from '../../config/env.schema.js';
import type { PlaceCandidate } from '../../stores/store.types.js';
import { ExternalServiceError, fetchJson } from '../http.js';
import type { PlacesProvider } from '../providers.js';
import {
  overpassQuery,
  toPlaceCandidate,
  type OverpassElement,
} from './osm.mapper.js';

const QUERY_TIMEOUT_SECONDS = 120;

/**
 * Free public Overpass servers are slow and sometimes busy, so each mirror in
 * OVERPASS_URLS is tried in turn. Called from the background discovery queue,
 * never while a person waits.
 */
@Injectable()
export class OverpassPlacesProvider implements PlacesProvider {
  readonly source = 'OSM' as const;
  private readonly logger = new Logger(OverpassPlacesProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async fetchArea(cell: Cell): Promise<PlaceCandidate[]> {
    const urls = this.config.get('OVERPASS_URLS', { infer: true });
    const body = new URLSearchParams({
      data: overpassQuery(cell, QUERY_TIMEOUT_SECONDS),
    }).toString();
    let lastError: unknown;

    for (const url of urls) {
      try {
        const { status, body: json } = await fetchJson<{
          elements: OverpassElement[];
        }>('overpass', url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          timeoutMs: (QUERY_TIMEOUT_SECONDS + 15) * 1000,
          userAgent: this.config.get('HTTP_USER_AGENT', { infer: true }),
        });
        if (!json) {
          throw new ExternalServiceError('overpass', status, `HTTP ${status}`);
        }
        return json.elements
          .map(toPlaceCandidate)
          .filter((place): place is PlaceCandidate => place !== null);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Overpass mirror failed (${url}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new ExternalServiceError('overpass', null, 'no mirror answered');
  }
}
