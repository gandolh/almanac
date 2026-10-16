import { configureAuth, getAuthClient, type AuthClient } from "../../vendor/ward/ward-auth-react.js";
import { API_BASE, onSignedOut } from "../api";
import { appBase } from "../base";
import { HOME, matchRoute, pathFor, type Route } from "../router";

/**
 * Signing in, from the browser. Almanac keeps its own accounts and its own
 * session: an opaque `almanac_session` cookie, HttpOnly, scoped to
 * `/almanac-api`. The vendored ward-auth hooks (`vendor/ward/`) talk to the
 * server's `/auth/*` routes and hold one shared session state, which the auth
 * gate (`AuthGate.tsx`) renders from; they draw nothing.
 *
 * - The client is set up here, once, when the app loads: it reads the result
 *   of a Ward round trip (`?ward=linked`, `?ward_error=…`) from the address and
 *   takes it out of the address bar.
 * - Any API call answered 401 (`api.ts`'s `onSignedOut`) means the session is
 *   over: the session state asks the server again, which flips the gate to
 *   the login page, with the reason when there is one (a Ward session ended).
 * - The page the person was on when the session ended is remembered, and
 *   signing in goes back to it, by password or through Ward.
 */

/** The auth plugin's routes as the browser sees them. */
export const AUTH_BASE_PATH = `${API_BASE}/auth`;

configureAuth({ basePath: AUTH_BASE_PATH });

/**
 * The client the hooks share, for an action outside a component (the account
 * menu's). Import it from here rather than calling the library's
 * `getAuthClient`, so the client is set up before anything asks for it.
 */
export function authClient(): AuthClient {
  return getAuthClient();
}

onSignedOut(() => {
  void authClient()
    .refresh()
    .catch(() => undefined);
});

// --- Where to go after signing in -----------------------------------------------

let returnPath: string | null = null;

/** A page of the app worth coming back to: a route it has, and not the login page. */
function returnRoute(): Route | null {
  const route = returnPath === null ? null : matchRoute(returnPath);
  return route !== null && route.name !== "login" ? route : null;
}

/** Remember the page the session ended on. The login page itself, or a path the app doesn't have, is not remembered. */
export function rememberReturnPath(pathname: string): void {
  const route = matchRoute(pathname);
  if (route !== null && route.name !== "login") returnPath = pathname;
}

/** Where signing in goes: the remembered page, else home. Read as often as needed; `forgetReturnPath` clears it. */
export function afterSignIn(): Route {
  return returnRoute() ?? HOME;
}

/** Signed in and on a page: nothing to go back to any more. */
export function forgetReturnPath(): void {
  returnPath = null;
}

/** Where "Sign in with Ward" lands: the remembered page, else the app's root. Always a path on this origin, under the base. */
export function wardReturnTo(): string {
  const route = returnRoute();
  return route === null ? appBase() : pathFor(route);
}
