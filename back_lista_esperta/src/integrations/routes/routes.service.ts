import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { fetchJson } from '../http.js';

export interface Point {
  lat: number;
  lng: number;
}

export interface RouteLeg {
  km: number;
  minutes: number;
}

export interface RouteMatrix {
  /** One way, from the person to each store. */
  fromOrigin: Map<string, RouteLeg>;
  between(a: string, b: string): RouteLeg;
  source: 'OPENROUTESERVICE' | 'ESTIMATE';
}

/** Straight line × typical street detour, at city driving speed. */
export const DETOUR_FACTOR = 1.3;
export const CITY_KMH = 25;
const ROUTE_CELL_DEGREES = 0.005; // ≈ 500 m (spec section 7)
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 20_000;
const MAX_LOCATIONS = 50; // ORS free plan: up to 3,500 matrix elements

export function haversineKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function estimateLeg(a: Point, b: Point): RouteLeg {
  const km = haversineKm(a, b) * DETOUR_FACTOR;
  return {
    km: Math.round(km * 100) / 100,
    minutes: Math.round((km / CITY_KMH) * 60 * 10) / 10,
  };
}

const cellOf = (p: Point) =>
  `${Math.floor(p.lat / ROUTE_CELL_DEGREES)}:${Math.floor(p.lng / ROUTE_CELL_DEGREES)}`;

/**
 * Car distances and times. With ORS_API_KEY: OpenRouteService matrix
 * (free, up to 2,000 requests/day), cached per ~500 m cell for 7 days.
 * Without it, or if ORS fails: the estimate above. The verdict says which.
 */
@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);
  private readonly cache = new Map<string, { at: number; leg: RouteLeg }>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  async matrix(
    origin: Point,
    stores: { id: string; lat: number; lng: number }[],
  ): Promise<RouteMatrix> {
    const points = new Map(
      stores.map((s) => [s.id, { lat: s.lat, lng: s.lng }]),
    );
    const key = (a: Point, b: Point) => `${cellOf(a)}>${cellOf(b)}`;
    const estimate = (): RouteMatrix => ({
      fromOrigin: new Map(stores.map((s) => [s.id, estimateLeg(origin, s)])),
      between: (a, b) => estimateLeg(points.get(a)!, points.get(b)!),
      source: 'ESTIMATE',
    });

    const apiKey = this.config.get('ORS_API_KEY', { infer: true });
    if (!apiKey || stores.length === 0) return estimate();

    const locations = [origin, ...stores].slice(0, MAX_LOCATIONS);
    const known = locations.every((a) =>
      locations.every((b) => a === b || this.cached(key(a, b))),
    );
    if (!known) {
      try {
        await this.fetchMatrix(locations, apiKey, key);
      } catch (error) {
        this.logger.warn(
          `OpenRouteService failed, using estimates: ${error instanceof Error ? error.message : String(error)}`,
        );
        return estimate();
      }
    }
    const leg = (a: Point, b: Point) =>
      this.cached(key(a, b)) ?? estimateLeg(a, b);
    return {
      fromOrigin: new Map(stores.map((s) => [s.id, leg(origin, s)])),
      between: (a, b) => leg(points.get(a)!, points.get(b)!),
      source: 'OPENROUTESERVICE',
    };
  }

  private cached(key: string): RouteLeg | undefined {
    const hit = this.cache.get(key);
    return hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.leg : undefined;
  }

  private async fetchMatrix(
    locations: Point[],
    apiKey: string,
    key: (a: Point, b: Point) => string,
  ) {
    const { status, body } = await fetchJson<{
      distances?: number[][];
      durations?: number[][];
    }>(
      'openrouteservice',
      `${this.config.get('ORS_URL', { infer: true })}/v2/matrix/driving-car`,
      {
        method: 'POST',
        headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations: locations.map((p) => [p.lng, p.lat]),
          metrics: ['distance', 'duration'],
          units: 'km',
        }),
        timeoutMs: 15_000,
        userAgent: this.config.get('HTTP_USER_AGENT', { infer: true }),
      },
    );
    if (!body?.distances || !body.durations) throw new Error(`HTTP ${status}`);
    if (this.cache.size > CACHE_MAX) this.cache.clear();
    const now = Date.now();
    locations.forEach((a, i) =>
      locations.forEach((b, j) => {
        const km = body.distances![i]?.[j];
        const seconds = body.durations![i]?.[j];
        if (i !== j && typeof km === 'number' && typeof seconds === 'number') {
          this.cache.set(key(a, b), {
            at: now,
            leg: { km, minutes: seconds / 60 },
          });
        }
      }),
    );
  }
}
