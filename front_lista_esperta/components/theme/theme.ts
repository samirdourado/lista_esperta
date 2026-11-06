/** Light is the app's theme; dark is an option the person turns on (D-071). */
export type ThemePreference = "light" | "dark";

export const THEME_STORAGE_KEY = "le-theme";
export const THEME_EVENT = "le-theme-change";

export function readThemePreference(): ThemePreference {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  try {
    if (preference === "dark") localStorage.setItem(THEME_STORAGE_KEY, "dark");
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode); the choice still lasts for this page view.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Runs before first paint so the dark choice never flashes the light theme. */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;
