import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { createWardClient, wardAuth } from "../vendor/ward/ward-auth.js";
import { USER_ROLE, openAccounts } from "./auth/accounts.js";
import { registerOriginGuard } from "./auth/guard.js";
import { AUTH_ROUTE_PREFIX, type Config } from "./config.js";
import { databasePath, openDb, type Db } from "./db/open.js";
import { registerErrorHandling } from "./errors.js";
import { calendarRoutes } from "./routes/calendars.js";
import { eventRoutes } from "./routes/events.js";
import { createPushService, type PushService } from "./push/push.js";
import { occurrenceRoutes } from "./routes/occurrences.js";
import { pushRoutes } from "./routes/push.js";
import { createReminders, startReminderTimer } from "./reminders/timer.js";
import { createSentLog } from "./reminders/sent-log.js";
import { searchRoutes } from "./routes/search.js";
import { settingsRoutes } from "./routes/settings.js";
import { createCalendarStore, type CalendarStore } from "./store/calendars.js";
import { createEventStore, type EventStore } from "./store/events.js";
import { createPushSubscriptionStore, type PushSubscriptionStore } from "./store/push-subscriptions.js";
import { createSettingsStore, type SettingsStore } from "./store/settings.js";

/** What every feature is handed. Add a field only when more than one feature needs it. */
export interface FeatureContext {
  config: Config;
  /** The one connection, migrated, closed with the app. */
  db: Db;
  /** The user's calendars (brief 03): the calendar routes. */
  calendars: CalendarStore;
  /** Events, series and exceptions (brief 03): the event, occurrence and search routes. */
  events: EventStore;
  /** The display time zone (brief 03): the settings routes, and every route that turns times into dates. */
  settings: SettingsStore;
  /** Browsers' push subscriptions (brief 14): the push routes, and whatever sends. */
  pushSubscriptions: PushSubscriptionStore;
  /** Sending a push to a user's browsers (brief 14); `undefined` when `config.push` is (no VAPID keys). */
  push: PushService | undefined;
}

/** The session cookie's name. Unique in the estate: every app shares one origin. */
export const SESSION_COOKIE = "almanac_session";

/**
 * Where the auth plugin's routes sit as Fastify sees them (`/auth`). The proxy
 * strips the API prefix, so the browser reaches them at `/almanac-api/auth/...`,
 * and the Ward callback at `/almanac-api/auth/ward/callback`.
 */
export { AUTH_ROUTE_PREFIX };

/** The only routes with no session, as `"METHOD /pattern"`. The plugin adds its own public `/auth/*` routes. */
export const PUBLIC_ROUTES: readonly string[] = ["GET /api/health"];

/**
 * Accounts and the guard (brief 02). The vendored `wardAuth` plugin keeps the
 * local accounts in this database and serves `/auth/*`: login, logout, the
 * session, the password, and "Sign in with Ward" when `config.ward` is set,
 * which also lets in anyone the owner grants Almanac in Ward, as a new user
 * with an empty calendar. There is no sign-up route (no `registration`).
 * Its `onRequest` hook refuses every other route without a live session
 * (`401 { error: "unauthorized" }`); `auth/guard.ts` then refuses a write
 * from another origin. Both are root hooks, so this feature goes first. A
 * route reads who is asking with `currentUserId(request)` (`auth/guard.ts`).
 */
const signIn: Feature = async (app, { config, db }) => {
  const accounts = openAccounts(db);
  // Checks the settings and imports the key now; talks to Ward only on first use, so the app starts while Ward is down.
  const ward = config.ward && (await createWardClient(config.ward));
  if (ward === undefined) {
    app.log.info("WARD_OIDC_ISSUER is not set: local accounts only, no Sign in with Ward.");
  } else if (new URL(ward.redirectUri).origin !== config.publicOrigin) {
    // Only Sign in with Ward breaks (its cookie lands on the other origin), so this warns rather than refusing to start.
    app.log.warn(`WARD_OIDC_REDIRECT_URI is not on PUBLIC_ORIGIN (${config.publicOrigin}): Sign in with Ward will not work.`);
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

/**
 * A feature sets itself up on the root app. Usually that is registering its
 * route plugin with the context, which keeps the plugin's hooks to itself:
 * `(app, ctx) => app.register(calendarRoutes, ctx)`. A root guard (brief 02's
 * `wardAuth`) registers on `app` directly and goes first, because Fastify
 * copies root hooks into a plugin's context when the plugin is created.
 */
export type Feature = (app: FastifyInstance, ctx: FeatureContext) => PromiseLike<unknown>;

/**
 * Every feature, set up in this order. A later brief adds its entry here and
 * nowhere else in this file. `signIn` stays first: a route set up before it
 * would have no guard.
 */
const FEATURES: Feature[] = [
  signIn,
  (app, ctx) => app.register(calendarRoutes, ctx),
  (app, ctx) => app.register(eventRoutes, ctx),
  (app, ctx) => app.register(occurrenceRoutes, ctx),
  (app, ctx) => app.register(searchRoutes, ctx),
  (app, ctx) => app.register(settingsRoutes, ctx),
  (app, ctx) => app.register(pushRoutes, ctx),
];

/**
 * Due reminders (brief 16), once a minute, while push is on and
 * `REMINDER_TIMER` isn't `off`. Stopped on close: the hook is added after the
 * one that closes the database, and Fastify runs a closing app's hooks last
 * added first, so a running tick finishes before the database goes.
 */
function startReminders(app: FastifyInstance, ctx: FeatureContext): void {
  if (ctx.push === undefined) return;
  if (!ctx.config.reminderTimer) {
    app.log.info("REMINDER_TIMER is off: this process sends no reminders.");
    return;
  }
  const reminders = createReminders({
    events: ctx.events,
    settings: ctx.settings,
    subscriptions: ctx.pushSubscriptions,
    sentLog: createSentLog(ctx.db),
    push: ctx.push,
    webBase: ctx.config.webBase,
    log: app.log,
  });
  const timer = startReminderTimer(reminders, app.log);
  app.addHook("onClose", () => timer.stop());
}

export interface BuildAppOptions {
  /** Fastify's logger option. Default off; `index.ts` turns it on. */
  logger?: FastifyServerOptions["logger"];
}

/**
 * The app, not listening, with `<dataDir>/almanac.db` open and migrated (the
 * accounts' tables too). Closing the app closes the database. Every route but
 * `GET /api/health` needs a session (`signIn` above).
 */
export async function buildApp(config: Config, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  const db = openDb(databasePath(config.dataDir));
  app.addHook("onClose", async () => {
    db.close();
  });

  // A request with `Content-Type: application/json` and no body (a client that
  // sets the header on every call, DELETE included) is a body of `undefined`,
  // not a 400. Anything else goes to Fastify's own parser, which keeps its
  // prototype-poisoning checks and its 400 for bad JSON.
  const parseJson = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    if (body === "") {
      done(null, undefined);
      return;
    }
    parseJson(request, body as string, done);
  });

  registerErrorHandling(app);

  app.get("/api/health", async () => ({ status: "ok" }));

  const pushSubscriptions = createPushSubscriptionStore(db);
  if (config.push === undefined) app.log.info("VAPID_* are not set: push notifications are off.");
  const ctx: FeatureContext = {
    config,
    db,
    calendars: createCalendarStore(db),
    events: createEventStore(db),
    settings: createSettingsStore(db),
    pushSubscriptions,
    push: config.push && createPushService({ vapid: config.push, subscriptions: pushSubscriptions, log: app.log }),
  };
  for (const feature of FEATURES) await feature(app, ctx);
  startReminders(app, ctx);

  return app;
}
