import { useSyncExternalStore } from "react";

/**
 * The Light / Dark / System switch. The choice lives on `<html data-theme>`, where the stylesheet's
 * `color-scheme` and its `light-dark()` colours read it, and in `localStorage` beside the sidebar's
 * preference (AppShell's `almanac.sidebar`), because that is where Almanac keeps what is only about
 * this device. A first visit is light, whatever the system says. The inline script in index.html
 * sets the attribute before the first paint, so a dark choice never flashes light; this module
 * keeps it after that, and follows the system while the choice is System.
 */
export type Theme = "light" | "dark" | "system";

export const THEMES: readonly Theme[] = ["light", "dark", "system"];

export const THEME_KEY = "almanac.theme";

/** The page's ground in each scheme, for the browser bar (`theme-color`): the `--color-ground` values in styles/index.css, which a test keeps equal. */
export const THEME_COLORS = { light: "#edede8", dark: "#11110d" } as const;

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** The stored choice; light when there is none or storage is blocked. */
export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

/** What a choice looks like right now: System is whatever the system is. */
export function resolveTheme(theme: Theme, systemDark: boolean): "light" | "dark" {
  return theme === "system" ? (systemDark ? "dark" : "light") : theme;
}

function systemDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

/** Puts a choice on the page: `data-theme`, the `color-scheme` meta and the browser bar's colour. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  const scheme = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (scheme) scheme.content = theme === "system" ? "light dark" : theme;
  const bar = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (bar) bar.content = THEME_COLORS[resolveTheme(theme, systemDark())];
}

let current: Theme = typeof window === "undefined" ? "light" : readTheme();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** The choice in force. */
export function getTheme(): Theme {
  return current;
}

/** Applies a choice, keeps it on this device, and tells every subscriber. */
export function setTheme(theme: Theme): void {
  current = theme;
  applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice lasts until the tab closes.
  }
  notify();
}

/** While the choice is System, the browser bar and FullCalendar follow a change of the system's. */
function followSystem(): void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    if (current !== "system") return;
    applyTheme(current);
    notify();
  });
}
followSystem();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The choice, re-rendering when it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}

/** What the page looks like now, `light` or `dark`, for what can't read the stylesheet (FullCalendar's colour scheme). */
export function useColorScheme(): "light" | "dark" {
  const theme = useTheme();
  return useSyncExternalStore(
    subscribe,
    () => resolveTheme(theme, systemDark()),
    () => "light",
  );
}
