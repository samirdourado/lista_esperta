export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "le-theme";
export const THEME_EVENT = "le-theme-change";

export function readThemePreference(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be blocked (private mode); the choice still lasts for this page view.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Runs before first paint so a stored preference never flashes the wrong theme. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
