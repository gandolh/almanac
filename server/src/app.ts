import rateLimit from "@fastify/rate-limit";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Config } from "./config.js";
import { databasePath, openDb, type Db } from "./db/open.js";
import { auth } from "./plugins/auth/index.js";
import { errors } from "./plugins/errors.js";
import { jsonBodyParser } from "./plugins/json-body.js";
import { calendarRoutes, createCalendarStore, type CalendarStore } from "./features/calendars/index.js";
import { createEventStore, eventRoutes, type EventStore } from "./features/events/index.js";
import { createFeedTokenStore, feedRoutes } from "./features/feed/index.js";
import { healthRoutes } from "./features/health/index.js";
import { occurrenceRoutes } from "./features/occurrences/index.js";
import {
  createPushService,
  createPushSubscriptionStore,
  pushRoutes,
  type PushService,
  type PushSubscriptionStore,
} from "./features/push/index.js";
import { startReminders } from "./features/reminders/index.js";
import { searchRoutes } from "./features/search/index.js";
import { createSettingsStore, settingsRoutes, type SettingsStore } from "./features/settings/index.js";

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
  (app) => app.register(healthRoutes),
  (app, ctx) => app.register(calendarRoutes, ctx),
  (app, ctx) => app.register(eventRoutes, ctx),
  (app, ctx) => app.register(occurrenceRoutes, ctx),
  (app, ctx) => app.register(searchRoutes, ctx),
  (app, ctx) => app.register(settingsRoutes, ctx),
  (app, ctx) => app.register(pushRoutes, ctx),
  (app, ctx) => app.register(feedRoutes, { ...ctx, feedTokens: createFeedTokenStore(ctx.db) }),
];

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
 * `GET /api/health` and the calendar feed's link needs a session (`plugins/auth`).
 */
export async function buildApp(config: Config, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, ...options.server });

  const db = openDb(databasePath(config.dataDir));
  app.addHook("onClose", async () => {
    db.close();
  });

  // 1. External plugins. The rate limiter isn't global: it limits the 404 handler and the routes
  // that ask for it (the calendar feed), each by the client's address.
  await app.register(rateLimit, { global: false });

  // 2. The app's own plugins, `fastify-plugin` wrapped so they reach everything after them. Errors
  // go first, so every plugin and feature inherits the one handler.
  await app.register(errors);
  await app.register(jsonBodyParser);
  // Zod checks every request and encodes every reply, in every plugin registered below.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // Accounts and the guard: `wardAuth`'s `onRequest` hook refuses every route set up after it
  // without a session, so this goes before every feature.
  await app.register(auth, { config, db });

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
  // 3. The features.
  for (const feature of FEATURES) await feature(app, ctx);
  startReminders(app, ctx);

  return app;
}
