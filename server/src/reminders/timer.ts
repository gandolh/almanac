import type { FastifyBaseLogger } from "fastify";
import type { PushService } from "../push/push.js";
import type { EventStore } from "../store/events.js";
import type { PushSubscriptionStore } from "../store/push-subscriptions.js";
import type { SettingsStore } from "../store/settings.js";
import { findDue, type Window } from "./due.js";
import { reminderPayload } from "./message.js";
import type { SentLog } from "./sent-log.js";

/** How often the timer looks for due reminders. */
export const TICK_MS = 60_000;
/** A reminder more than this late is dropped, not sent: after a restart, or a server that was asleep. */
export const STALE_MS = 15 * 60_000;
/** How long the sent log keeps a row. */
export const SENT_KEEP_MS = 3 * 86_400_000;

export interface ReminderDeps {
  events: EventStore;
  settings: SettingsStore;
  subscriptions: PushSubscriptionStore;
  sentLog: SentLog;
  push: PushService;
  /** The web app's base path, for the day a notification opens. */
  webBase: string;
  log: Pick<FastifyBaseLogger, "info" | "warn" | "error">;
  /** The clock, epoch ms. Tests hand in a fake one. */
  now?: () => number;
}

export interface Reminders {
  /**
   * Sends every reminder due since the last tick (at most `STALE_MS` back;
   * the first tick looks back that far from when this was made) to every
   * browser the user turned notifications on in, each once. Resolves to how
   * many reminders it sent.
   */
  tick(): Promise<{ sent: number }>;
}

/**
 * Due reminders (brief 16). Only users with a push subscription are looked
 * at: nobody else could be told. Each reminder is claimed in the sent log
 * before it goes out, so a failed push is not retried, as brief 14's pushes
 * aren't.
 */
export function createReminders(deps: ReminderDeps): Reminders {
  const now = deps.now ?? Date.now;
  let lastTo = now() - STALE_MS;

  return {
    async tick() {
      const to = now();
      const window: Window = { from: Math.max(lastTo, to - STALE_MS), to };
      if (window.to <= window.from) return { sent: 0 };
      const sends: Promise<unknown>[] = [];
      for (const userId of deps.subscriptions.userIds()) {
        const { timeZone } = deps.settings.get(userId);
        for (const { occurrence, dueAt } of findDue(deps.events, userId, timeZone, window, deps.log)) {
          if (!deps.sentLog.claim(occurrence.eventId, occurrence.start, to)) continue;
          sends.push(deps.push.sendToUser(userId, reminderPayload(occurrence, dueAt, timeZone, deps.webBase)));
        }
      }
      await Promise.all(sends);
      lastTo = to;
      deps.sentLog.prune(to - SENT_KEEP_MS);
      return { sent: sends.length };
    },
  };
}

export interface ReminderTimer {
  /** Stops the timer and waits for a tick that is running. */
  stop(): Promise<void>;
}

/**
 * Runs `reminders.tick` every `TICK_MS` (the first a minute after starting,
 * covering the quarter of an hour before the start too). A tick still
 * running when the next is due is left to finish and the next skipped; a
 * tick that fails is logged and the next one tries again from the same point.
 * The interval doesn't keep the process alive.
 */
export function startReminderTimer(reminders: Reminders, log: Pick<FastifyBaseLogger, "error">, intervalMs = TICK_MS): ReminderTimer {
  let running: Promise<void> | null = null;
  const interval = setInterval(() => {
    if (running !== null) return;
    running = reminders
      .tick()
      .then(
        () => undefined,
        (error: unknown) => log.error({ err: error }, "reminders tick failed"),
      )
      .finally(() => {
        running = null;
      });
  }, intervalMs);
  interval.unref();
  return {
    async stop() {
      clearInterval(interval);
      await running;
    },
  };
}
