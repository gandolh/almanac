import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Config } from "./config.js";
import { databasePath, openDb, type Db } from "./db/open.js";
import { auth } from "./plugins/auth/index.js";
import { errors } from "./plugins/errors.js";
import { jsonBodyParser } from "./plugins/json-body.js";
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
  /** The user's calendars: the calendar routes. */
  calendars: CalendarStore;
  /** Events, series and exceptions: the event, occurrence and search routes. */
  events: EventStore;
  /** The display time zone: the settings routes, and every route that turns times into dates. */
  settings: SettingsStore;
  /** Browsers' push subscriptions: the push routes, and whatever sends. */
  pushSubscriptions: PushSubscriptionStore;
  /** Sending a push to a user's browsers; `undefined` when `config.push` is (no VAPID keys). */
  push: PushService | undefined;
}

/**
 * A feature sets itself up on the root app. Usually that is registering its
 * route plugin with the context, which keeps the plugin's hooks to itself:
 * `(app, ctx) => app.register(calendarRoutes, ctx)`. A root guard (the
 * `wardAuth` plugin) registers on `app` directly and goes first, because Fastify
 * copies root hooks into a plugin's context when the plugin is created.
 */
export type Feature = (app: FastifyInstance, ctx: FeatureContext) => PromiseLike<unknown>;

/**
 * Every feature, set up in this order, after the plugins (`buildApp`). A new
 * feature adds its entry here and nowhere else in this file.
 */
const FEATURES: Feature[] = [
  (app, ctx) => app.register(calendarRoutes, ctx),
  (app, ctx) => app.register(eventRoutes, ctx),
  (app, ctx) => app.register(occurrenceRoutes, ctx),
  (app, ctx) => app.register(searchRoutes, ctx),
  (app, ctx) => app.register(settingsRoutes, ctx),
  (app, ctx) => app.register(pushRoutes, ctx),
];

/**
 * Due reminders, once a minute, while push is on and
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

/** Fastify's options that belong to the process. `server.ts` sets them; a test leaves them out. */
export type ServerOptions = Pick<
  FastifyServerOptions,
  "logger" | "trustProxy" | "connectionTimeout" | "requestTimeout" | "keepAliveTimeout"
>;

export interface BuildAppOptions {
  /** The process's options: the logger (default off), `trustProxy` and the timeouts. */
  server?: ServerOptions;
}

/**
 * The app, not listening, with `<dataDir>/almanac.db` open and migrated (the
 * accounts' tables too). Closing the app closes the database. Every route but
 * `GET /api/health` needs a session (`signIn` above).
 */
export async function buildApp(config: Config, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, ...options.server });

  const db = openDb(databasePath(config.dataDir));
  app.addHook("onClose", async () => {
    db.close();
  });

  // 1. The app's own plugins, `fastify-plugin` wrapped so they reach everything after them. Errors
  // go first, so every plugin and feature inherits the one handler.
  await app.register(errors);
  await app.register(jsonBodyParser);
  // Zod checks every request and encodes every reply, in every plugin registered below.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // Accounts and the guard: `wardAuth`'s `onRequest` hook refuses every route set up after it
  // without a session, so this goes before every feature.
  await app.register(auth, { config, db });

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
  // 2. The features.
  for (const feature of FEATURES) await feature(app, ctx);
  startReminders(app, ctx);

  return app;
}
