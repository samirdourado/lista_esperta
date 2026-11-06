/**
 * Panels that open over the home page (D-072). The URL carries the open panel,
 * so a link from anywhere can open it and the back button closes it.
 */
export const PANEL_PARAM = "painel";

export const PANELS = {
  receipt: "nota",
  howItWorks: "como-calculamos",
} as const;

export type PanelName = keyof typeof PANELS;

export const PANEL_HREF: Record<PanelName, string> = {
  receipt: `/?${PANEL_PARAM}=${PANELS.receipt}`,
  howItWorks: `/?${PANEL_PARAM}=${PANELS.howItWorks}`,
};

export function panelFrom(value: string | null): PanelName | null {
  const entry = Object.entries(PANELS).find(([, slug]) => slug === value);
  return entry ? (entry[0] as PanelName) : null;
}
