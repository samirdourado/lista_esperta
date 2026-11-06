"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { applyThemePreference, readThemePreference, THEME_EVENT } from "./theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

/** Light by default; one tap switches to dark and back. */
export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => "light" as const);
  const dark = preference === "dark";

  return (
    <button
      type="button"
      onClick={() => applyThemePreference(dark ? "light" : "dark")}
      className="inline-flex size-tap items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunken hover:text-ink"
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      aria-pressed={dark}
      title={dark ? "Tema claro" : "Tema escuro"}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
