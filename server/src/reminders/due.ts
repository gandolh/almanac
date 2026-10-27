import { DAY_MS, addDays, dateInZone, parseInstant, type Occurrence } from "@almanac/shared";
import { Temporal } from "temporal-polyfill";
import { expandSeries, isSeries, rowOccurrence } from "../recurrence/expand.js";
import type { EventRange, EventStore } from "../store/events.js";

/**
 * Which reminders fall due in a window (brief 16), worked out from the rows as
 * they are now: an event deleted, moved or given another reminder before its
 * reminder is due simply no longer has the old one.
 */

/** A window of instants, `(from, to]`, epoch ms: a reminder due exactly at `from` belonged to the window before. */
export interface Window {
  from: number;
  to: number;
}

/** One reminder to send. */
export interface DueReminder {
  /** The occurrence it is for: a one-off or exception as stored, or one a series generates. */
  occurrence: Occurrence;
  /** When it is due, epoch ms. */
  dueAt: number;
}

/**
 * When an occurrence's reminder is due, or null when it has none. Each
 * occurrence is judged by its own kind: an exception can be timed under an
 * all-day series.
 *
 * - Timed: `reminderMinutes` before the start, in real time.
 * - All-day: `reminderMinutes` before 00:00 of the start date on the wall
 *   clock, in the user's display time zone, so 900 is 09:00 the day before and
 *   -540 is 09:00 on the day even on a day the clocks change. A wall-clock time
 *   that doesn't exist that day moves on, as everywhere else.
 */
export function dueAt(occurrence: Pick<Occurrence, "allDay" | "start" | "reminderMinutes">, timeZone: string): number | null {
  const minutes = occurrence.reminderMinutes;
  if (minutes === null) return null;
  if (!occurrence.allDay) return parseInstant(occurrence.start) - minutes * 60_000;
  return Temporal.PlainDate.from(occurrence.start)
    .toPlainDateTime()
    .subtract({ minutes })
    .toZonedDateTime(timeZone, { disambiguation: "compatible" }).epochMilliseconds;
}

const HOUR_MS = 3_600_000;

/**
 * The rows and the stretch of series to look at for reminders due in
 * `window`. A timed reminder is at most a day before its start, so a start up
 * to a day after the window (the end is exclusive, hence the extra
 * millisecond). An all-day one is between 15 hours before 00:00 and 9 hours
 * after, so the dates from 10 hours before the window to 16 hours after it in
 * the user's zone, an hour each way for a clock change.
 */
export function lookahead(window: Window, timeZone: string): EventRange {
  return {
    from: window.from,
    to: window.to + DAY_MS + 1,
    dates: {
      start: dateInZone(window.from - 10 * HOUR_MS, timeZone),
      end: addDays(dateInZone(window.to + 16 * HOUR_MS, timeZone), 1),
    },
  };
}

export interface FindLog {
  warn(details: object, message: string): void;
}

/**
 * The user's reminders due in `window`, by due time. One-off events and
 * exceptions are their own rows (each with its own kind and reminder); a
 * series with a reminder is expanded over the lookahead only, less its
 * excluded dates and the occurrences its exceptions replace. A series that
 * won't expand is logged and skipped, as the views skip it.
 */
export function findDue(events: EventStore, userId: string, timeZone: string, window: Window, log?: FindLog): DueReminder[] {
  const range = lookahead(window, timeZone);
  const candidates: Occurrence[] = events
    .listInRange(userId, range)
    .filter((row) => row.reminderMinutes !== null)
    .map((row) => rowOccurrence(row, null));
  for (const series of events.listSeries(userId, range)) {
    if (!isSeries(series) || series.reminderMinutes === null) continue;
    try {
      candidates.push(...expandSeries(series, events.listExceptions(userId, series.id), range));
    } catch (error) {
      log?.warn({ userId, seriesId: series.id, err: error }, "a repeating event did not expand for reminders; skipped");
    }
  }
  const due: DueReminder[] = [];
  for (const occurrence of candidates) {
    const at = dueAt(occurrence, timeZone);
    if (at !== null && at > window.from && at <= window.to) due.push({ occurrence, dueAt: at });
  }
  return due.sort((a, b) => a.dueAt - b.dueAt || a.occurrence.id.localeCompare(b.occurrence.id));
}
