/**
 * The app's root path on the shared origin, with one trailing slash:
 * `/almanac/` unless the build set `ALMANAC_BASE` (vite.config.ts). Read on
 * every call rather than once at module load, so tests can stub
 * `import.meta.env.BASE_URL`.
 */
export function appBase(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

/** Where Caddy (and the Vite dev proxy) serve the API, as the browser sees it. */
export const API_BASE = "/almanac-api";
