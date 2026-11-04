"use client";

import { useSyncExternalStore } from "react";
import { AutoThemeIcon, MoonIcon, SunIcon } from "@/components/icons";
import { applyThemePreference, readThemePreference, THEME_EVENT, type ThemePreference } from "./theme";

const NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };

const LABEL: Record<ThemePreference, string> = {
  system: "Tema igual ao do aparelho",
  light: "Tema claro",
  dark: "Tema escuro",
};

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => "system" as const);
  const next = NEXT[preference];
  const Icon = preference === "light" ? SunIcon : preference === "dark" ? MoonIcon : AutoThemeIcon;

  return (
    <button
      type="button"
      onClick={() => applyThemePreference(next)}
      className="inline-flex size-tap items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunken hover:text-ink"
      aria-label={`${LABEL[preference]}. Mudar para: ${LABEL[next].toLowerCase()}`}
      title={LABEL[preference]}
    >
      <Icon />
    </button>
  );
}
