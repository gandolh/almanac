import { useMemo, useSyncExternalStore } from "react";
import type { Temporal } from "temporal-polyfill";
import { appBase } from "./base";
import { dateFrom, isView, type View } from "./dates";

export type { View } from "./dates";

/**
 * The router, without a library: the History API under the app's base
 * (`/almanac/` by default). A route is one line in `ROUTES`; a `:name`
 * segment is a parameter, handed to the page as a decoded string.
 *
 *   /almanac/                    home    goes on to this month (the shell's redirect)
 *   /almanac/login               login   signing in (brief 02)
 *   /almanac/day/2026/10/16      day     the four views, each on a full date, kept
 *   /almanac/week/2026/10/16     week      when switching views, as Google does
 *   /almanac/month/2026/10/16    month
 *   /almanac/year/2026/10/16     year
 *   /almanac/search?q=sedinta    search  the results for `?q=` (brief 10)
 *
 * Anything else is home. The view routes' dates are written unpadded
 * (`/month/2026/1/5`); a padded or otherwise loose address is rewritten to
 * that form, and an impossible date (`/month/2026/2/30`) goes home. Build and
 * read them with `viewRoute` and `dateOfRoute`, never by hand.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  day: "/day/:y/:m/:d",
  week: "/week/:y/:m/:d",
  month: "/month/:y/:m/:d",
  year: "/year/:y/:m/:d",
  search: "/search",
} as const;

export type RouteName = keyof typeof ROUTES;

/** `"/day/:y/:m/:d"` → `"y" | "m" | "d"`. */
type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

/** A route's parameters, decoded: `{}` for a route without any. */
export type RouteParams<N extends RouteName> = { [K in ParamNames<(typeof ROUTES)[N]>]: string };

export type Route = { [N in RouteName]: { name: N; params: RouteParams<N> } }[RouteName];
export type RouteOf<N extends RouteName> = Extract<Route, { name: N }>;

export const HOME: RouteOf<"home"> = { name: "home", params: {} };
export const LOGIN: RouteOf<"login"> = { name: "login", params: {} };
export const SEARCH: RouteOf<"search"> = { name: "search", params: {} };

/** Any route by name: `route("login", {})`. */
export function route<N extends RouteName>(name: N, params: RouteParams<N>): RouteOf<N> {
  return { name, params } as RouteOf<N>;
}

// --- The views ------------------------------------------------------------------

/** A view's route: `/month/2026/10/16`. */
export type ViewRoute = RouteOf<View>;

/** The route of `view` on `date`: how every brief moves between views and dates. */
export function viewRoute(view: View, date: Temporal.PlainDate): ViewRoute {
  return { name: view, params: { y: String(date.year), m: String(date.month), d: String(date.day) } };
}

export function isViewRoute(to: Route): to is ViewRoute {
  return isView(to.name);
}

const NUMBER = /^\d{1,4}$/;

/** The date a view route is on, or `null` when its parameters are not a real date. */
export function dateOfRoute(to: ViewRoute): Temporal.PlainDate | null {
  const { y, m, d } = to.params;
  if (![y, m, d].every((part) => NUMBER.test(part))) return null;
  return dateFrom(Number(y), Number(m), Number(d));
}

// --- Matching -------------------------------------------------------------------

type RouteTable = Readonly<Record<string, string>>;

function segments(path: string): string[] {
  return path.split("/").filter((segment) => segment !== "");
}

/**
 * Which route a pathname is, or `null` for one the app doesn't have (and for
 * any path outside the base). Trailing and doubled slashes are forgiven; the
 * shell then rewrites the address to the canonical one.
 */
export function matchRoute(pathname: string, base: string = appBase(), table: RouteTable = ROUTES): Route | null {
  const root = base.replace(/\/+$/, "");
  if (pathname !== root && !pathname.startsWith(`${root}/`)) return null;
  const parts = segments(pathname.slice(root.length));

  for (const [name, pattern] of Object.entries(table)) {
    const expected = segments(pattern);
    if (expected.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const matches = expected.every((segment, index) => {
      const part = parts[index] ?? "";
      if (!segment.startsWith(":")) return segment === part;
      const value = decode(part);
      if (value === null || value.trim() === "") return false;
      params[segment.slice(1)] = value;
      return true;
    });
    if (matches) return { name, params } as Route;
  }
  return null;
}

/** A path segment decoded, or `null` for a malformed escape such as `%E0%A4%A`. */
function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** The canonical path of a route under the base: `/almanac/login`. */
export function pathFor(to: Route, base: string = appBase()): string {
  const pattern: string = ROUTES[to.name];
  const params = to.params as Record<string, string>;
  const filled = segments(pattern).map((segment) =>
    segment.startsWith(":") ? encodeURIComponent(params[segment.slice(1)] ?? "") : segment,
  );
  return `${base}${filled.join("/")}`;
}

/** A query string from a record: `{ q: "a b" }` → `?q=a+b`; empty values are left out, and nothing at all is `""`. */
export function queryString(query: Readonly<Record<string, string>> | undefined): string {
  if (query === undefined) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== "") search.set(key, value);
  const text = search.toString();
  return text === "" ? "" : `?${text}`;
}

/** A route with a query, as a link's `href`: `/almanac/search?q=gym`. */
export function hrefFor(to: Route, query?: Readonly<Record<string, string>>, base: string = appBase()): string {
  return `${pathFor(to, base)}${queryString(query)}`;
}

export function sameRoute(a: Route, b: Route): boolean {
  return a.name === b.name && pathFor(a, "/") === pathFor(b, "/");
}

// --- Navigation -----------------------------------------------------------------

const NAVIGATE_EVENT = "almanac:navigate";

/**
 * Kept on each history entry: how many in-app entries sit behind it, and the
 * path of the one just behind, so a back link can tell whether the browser's
 * Back would land where it says.
 */
interface HistoryState {
  almanacDepth?: number;
  almanacFrom?: string;
}

function currentState(): HistoryState {
  return (window.history.state as HistoryState | null) ?? {};
}

function depth(): number {
  const { almanacDepth } = currentState();
  return typeof almanacDepth === "number" ? almanacDepth : 0;
}

export interface NavigateOptions {
  /** Swap the current history entry instead of adding one. */
  replace?: boolean;
  /** The address's query: `{ q: "gym" }` for the search route. Left out, the new address has none. */
  query?: Readonly<Record<string, string>>;
}

/** Go to a route without a reload. A visit to the address already open (path and query) does nothing. */
export function navigate(to: Route, options: NavigateOptions = {}): void {
  const href = hrefFor(to, options.query);
  if (options.replace) {
    window.history.replaceState({ ...currentState() } satisfies HistoryState, "", href);
  } else {
    if (`${window.location.pathname}${window.location.search}` === href) return;
    const entry: HistoryState = { almanacDepth: depth() + 1, almanacFrom: window.location.pathname };
    window.history.pushState(entry, "", href);
    // A new page starts at its top; Back and Forward keep the browser's own restoring.
    window.scrollTo(0, 0);
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/** Open the search results for `query` (brief 10's search box): `/search?q=…`. */
export function navigateToSearch(query: string, options: { replace?: boolean } = {}): void {
  navigate(SEARCH, { ...options, query: { q: query } });
}

/**
 * Rewrite the address to the route's canonical path, keeping the query and
 * the hash (a sign-in callback's, say). For the shell's tidy-up of unknown
 * paths and stray slashes.
 */
export function replaceWithCanonical(to: Route): void {
  const { search, hash } = window.location;
  window.history.replaceState({ ...currentState() } satisfies HistoryState, "", `${pathFor(to)}${search}${hash}`);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/**
 * A back link to `to`: the browser's Back when the entry behind this one is
 * `to` (so the page comes back scrolled as it was left), otherwise (a deep
 * link, a fresh tab, arriving from elsewhere) a plain visit to `to`.
 */
export function goBack(to: Route = HOME): void {
  const { almanacFrom } = currentState();
  if (depth() > 0 && almanacFrom === pathFor(to)) window.history.back();
  else navigate(to);
}

// --- The last view ------------------------------------------------------------------

let lastView: ViewRoute | null = null;

/** The shell notes each view it shows, so leaving search can go back to it. */
export function rememberViewRoute(to: ViewRoute): void {
  lastView = to;
}

/**
 * The last day, week, month or year view shown in this tab, or home (which
 * goes on to this month) before any. Brief 10's search box returns here:
 * `goBack(lastViewRoute())`.
 */
export function lastViewRoute(): ViewRoute | RouteOf<"home"> {
  return lastView ?? HOME;
}

// --- Hooks ----------------------------------------------------------------------------

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

function currentPathname(): string {
  return window.location.pathname;
}

function currentSearch(): string {
  return window.location.search;
}

/** The raw pathname; re-renders on navigation and on Back/Forward. */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, currentPathname);
}

/** The address's query string (`?q=gym`, or `""`); re-renders on navigation and on Back/Forward. */
function useLocationSearch(): string {
  return useSyncExternalStore(subscribe, currentSearch, () => "");
}

/** One query parameter of the address, `""` when it has none: `useQueryParam("q")` on the search route. */
export function useQueryParam(name: string): string {
  const search = useLocationSearch();
  return useMemo(() => new URLSearchParams(search).get(name) ?? "", [search, name]);
}

/** The current route, or `null` when the address is not one the app has. */
export function useMatchedRoute(): Route | null {
  const pathname = usePathname();
  return useMemo(() => matchRoute(pathname), [pathname]);
}

/** The current route; an unknown address is home. */
export function useRoute(): Route {
  return useMatchedRoute() ?? HOME;
}
