/** Served from public/ (see scripts/copy-maplibre-worker.mjs). */
export const MAPLIBRE_WORKER_URL = "/vendor/maplibre/maplibre-gl-worker.mjs";

let loader: Promise<typeof import("maplibre-gl")> | null = null;

/** Loads MapLibre on the client once and points it at its worker. */
export function loadMapLibre(): Promise<typeof import("maplibre-gl")> {
  loader ??= import("maplibre-gl").then((maplibre) => {
    maplibre.setWorkerUrl(MAPLIBRE_WORKER_URL);
    return maplibre;
  });
  return loader;
}
