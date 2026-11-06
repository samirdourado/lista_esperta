/**
 * Free vector tiles from OpenFreeMap (OpenStreetMap data, no key):
 * https://openfreemap.org. Attribution is shown by MapLibre.
 */
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

export function isDarkTheme(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

export function mapStyleUrl(): string {
  return isDarkTheme() ? STYLE_DARK : STYLE_LIGHT;
}

/** Brand colours for map layers (canvas cannot read CSS variables). */
export const MAP_COLORS = {
  store: "#0754e0",
  storeDark: "#6b9bff",
  selected: "#10224a",
  selectedDark: "#e8eefc",
  /** The logo's location pin. */
  you: "#feb204",
  outline: "#ffffff",
} as const;

/** Round dot used for "você está aqui". */
export function youAreHereElement(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${MAP_COLORS.you};border:3px solid #fff;box-shadow:0 0 0 6px rgb(254 178 4 / 0.3)`;
  return el;
}
