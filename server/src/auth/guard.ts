import type { FastifyInstance, FastifyRequest } from "fastify";
// The type brings the plugin's `request.auth` declaration into every file that uses `currentUserId`.
import type { AuthContext } from "../../vendor/ward/ward-auth.js";
import { ApiError, sendError } from "../errors.js";

/**
 * Almanac's half of the guard. The vendored `wardAuth` plugin (`app.ts`,
 * registered before any route) is the other half: one root `onRequest` hook
 * that answers `401 { error: "unauthorized" }` to every route without a live
 * session except `GET /api/health`, judged by route pattern, and its own
 * `/auth/*` routes. Every route a later brief adds is behind it without doing
 * anything; `request.auth` is the signed-in user there, and `currentUserId`
 * below is how a route asks for it.
 *
 * What is left here: **a write a browser sent from another origin is a 403
 * `forbidden`** (`crossOriginWrite`). The plugin refuses those on its own
 * `POST /auth/*` routes only, so this hook covers every other route. The
 * session cookie is `SameSite=Lax`, which still lets a page on a sibling
 * subdomain (same site, another origin) post a body-less form with it
 * attached; this is what stops that.
 */

/**
 * The signed-in user's id, which every row a route reads or writes is scoped
 * by. The plugin's guard has already refused a request without a session, so
 * this throws only on a route that is public (`PUBLIC_ROUTES`) and should not
 * be asking: a 401 `unauthorized`, in Almanac's error shape.
 */
export function currentUserId(request: FastifyRequest): string {
  const auth: AuthContext | null = request.auth;
  if (auth === null) throw new ApiError("unauthorized", "Sign in to carry on.");
  return auth.user.id;
}

/** Methods that change nothing, so a cross-origin one is harmless. */
const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether this is a write a browser sent from a page on another origin: a
 * method other than GET, HEAD and OPTIONS, and
 *
 * - a `Sec-Fetch-Site` that is not `same-origin`, or
 * - an `Origin` that is not exactly `publicOrigin` (the string `null` included).
 *
 * The same rule the plugin applies to its own routes. A request with neither
 * header was not sent by a current browser (curl, a script, the tests), so no
 * page can have made it ride on a user's cookie, and it passes.
 *
 * In development the Vite proxy hands the server the page's own origin as
 * `PUBLIC_ORIGIN` (`web/vite.config.ts`).
 */
export function crossOriginWrite(request: FastifyRequest, publicOrigin: string): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  const fetchSite = request.headers["sec-fetch-site"];
  if (fetchSite !== undefined && fetchSite !== "" && fetchSite !== "same-origin") return true;
  const origin = request.headers.origin;
  return origin !== undefined && origin !== "" && origin !== publicOrigin;
}

export interface OriginGuardOptions {
  /** The app's own origin as the browser sees it (`config.publicOrigin`). */
  publicOrigin: string;
  /** The plugin's route prefix (`/auth`): its routes keep the plugin's own check and its `cross_site` answer. */
  authRoutePrefix: string;
}

/**
 * Register right after `wardAuth`, on the root, before any route plugin: a
 * root hook reaches a plugin only if it exists when the plugin is created.
 * It runs after the plugin's guard, so a request without a session has
 * already been answered 401.
 */
export function registerOriginGuard(app: FastifyInstance, { publicOrigin, authRoutePrefix }: OriginGuardOptions): void {
  app.addHook("onRequest", async (request, reply) => {
    if ((request.routeOptions.url ?? "").startsWith(`${authRoutePrefix}/`)) return;
    if (!crossOriginWrite(request, publicOrigin)) return;
    request.log.warn({ method: request.method, url: request.url }, "cross-origin write refused");
    return sendError(reply, "forbidden", "Almanac only accepts changes from its own pages.");
  });
}
