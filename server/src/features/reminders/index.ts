import type { FastifyInstance } from "fastify";
import type { Config } from "../../config.js";
import type { Db } from "../../db/open.js";
import type { EventStore } from "../events/index.js";
import type { PushService, PushSubscriptionStore } from "../push/index.js";
import type { SettingsStore } from "../settings/index.js";
import { createSentLog } from "./sent-log.js";
import { createReminders, startReminderTimer } from "./timer.js";

/** What the reminders take from the app. */
export interface ReminderOptions {
  config: Config;
  db: Db;
  events: EventStore;
  settings: SettingsStore;
  pushSubscriptions: PushSubscriptionStore;
  /** `undefined` when push is off: then nothing starts. */
  push: PushService | undefined;
}

/**
 * Due reminders, once a minute, while push is on and
 * `REMINDER_TIMER` isn't `off`. Stopped on close: the hook is added after the
 * one that closes the database, and Fastify runs a closing app's hooks last
 * added first, so a running tick finishes before the database goes.
 */
export function startReminders(app: FastifyInstance, ctx: ReminderOptions): void {
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
