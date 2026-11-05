// MapLibre finds its web worker with new URL(variable, import.meta.url), which
// bundlers cannot follow. The worker is copied to public/ and set with
// setWorkerUrl() in components/map/load-maplibre.ts. Runs on postinstall.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const target = join(root, "public/vendor/maplibre/maplibre-gl-worker.mjs");

if (!existsSync(source)) {
  console.warn("maplibre-gl is not installed; skipping worker copy");
} else {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
