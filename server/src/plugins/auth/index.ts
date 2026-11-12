import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createWardClient, wardAuth } from "../../../vendor/ward/ward-auth.js";
import { AUTH_ROUTE_PREFIX, type Config } from "../../config.js";
import type { Db } from "../../db/open.js";
import { USER_ROLE, openAccounts } from "./accounts.js";
import { registerOriginGuard } from "./guard.js";

/** What the sign-in plugin takes from the app. */
export interface AuthOptions {
  config: Config;
  /** The one connection: the library keeps its tables in it. */
  db: Db;
}

/** The session cookie's name. Unique in the estate: every app shares one origin. */
export const SESSION_COOKIE = "almanac_session";

/** The only routes with no session, as `"METHOD /pattern"`. The plugin adds its own public `/auth/*` routes. */
export const PUBLIC_ROUTES: readonly string[] = ["GET /api/health"];

/**
 * Accounts and the guard. The vendored `wardAuth` plugin keeps the
 * local accounts in this database and serves `/auth/*`: login, logout, the
 * session, the password, and "Sign in with Ward" when `config.ward` is set,
 * which also lets in anyone the owner grants Almanac in Ward, as a new user
 * with an empty calendar. There is no sign-up route (no `registration`).
 * Its `onRequest` hook refuses every other route without a live session
 * (`401 { error: "unauthorized" }`); `plugins/auth/guard.ts` then refuses a write
 * from another origin. Both are root hooks, so this feature goes first. A
 * route reads who is asking with `currentUserId(request)` (`plugins/auth/guard.ts`).
 */
const signIn: FastifyPluginAsync<AuthOptions> = async (app, { config, db }) => {
  const accounts = openAccounts(db);
  // Checks the settings and imports the key now; talks to Ward only on first use, so the app starts while Ward is down.
  const ward = config.ward && (await createWardClient(config.ward));
  if (ward === undefined) {
    app.log.info("WARD_OIDC_ISSUER is not set: local accounts only, no Sign in with Ward.");
  } else if (new URL(ward.redirectUri).origin !== config.publicOrigin) {
    // Only Sign in with Ward breaks (its cookie lands on the other origin), so this warns rather than refusing to start.
    app.log.warn(
      `WARD_OIDC_REDIRECT_URI is not on PUBLIC_ORIGIN (${config.publicOrigin}): Sign in with Ward will not work.`,
    );
  }

  await app.register(wardAuth, {
    accounts,
    cookieName: SESSION_COOKIE,
    // The API prefix as the browser sees it: every request that needs the session is under it.
    cookiePath: config.apiPrefix,
    publicOrigin: config.publicOrigin,
    routePrefix: AUTH_ROUTE_PREFIX,
    publicRoutes: PUBLIC_ROUTES,
    // From the config (AUTH_TRUSTED_PROXIES), so the plugin never reads the environment itself.
    trustedProxies: config.trustedProxies,
    ...(ward && {
      ward: {
        client: ward,
        // Browser paths. There is no settings page: the account menu is on every page, so a link comes back to the calendar.
        loginPath: `${config.webBase}login`,
        settingsPath: config.webBase,
        afterSignInPath: config.webBase,
        roleFor: () => USER_ROLE,
      },
    }),
  });
  registerOriginGuard(app, { publicOrigin: config.publicOrigin, authRoutePrefix: AUTH_ROUTE_PREFIX });
};

/** `fastify-plugin` wrapped, so `wardAuth` and the origin guard stay root hooks that reach every feature. */
export const auth = fp(signIn, { name: "auth" });
