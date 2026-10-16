import { z } from "zod";

/**
 * Instants, dates, occurrence keys and the display time zone
 * (corpus/wiki/glossary.md). Plain `Intl` and `Date` maths: the server and the
 * web app both use these, and neither needs Temporal for them.
 *
 * - A timed time is an instant, sent and stored as UTC. On the wire it is
 *   `2026-10-16T07:00:00Z`: whole seconds, no milliseconds, always `Z`
 *   (`formatInstant`). Input may carry any offset; it is turned into this form.
 * - An all-day time is a date, `2026-10-16`. An all-day event's end date is
 *   exclusive: a one-day event on 16 October ends on `2026-10-17`.
 * - An occurrence key names one occurrence of a series by its original start:
 *   the instant in the form above for a timed series, the date for an all-day
 *   one. So an unchanged occurrence's `start` is its key.
 */

/** Where every user's display time zone starts (corpus/wiki/decisions.md). */
export const DEFAULT_TIME_ZONE = "Europe/Bucharest";

/** The longest range `GET /api/occurrences` answers, in days. A year view (366 days) fits. */
export const MAX_RANGE_DAYS = 400;

export const DAY_MS = 86_400_000;

/** "UTC", or an IANA `Area/Location` name: each part starts with a capital, as every name in the database does. */
const ZONE_NAME = /^(?:UTC|[A-Z][A-Za-z0-9_+-]*(?:\/[A-Z][A-Za-z0-9_+-]*)+)$/;

/**
 * Whether `zone` is an IANA time zone name this runtime knows, such as
 * `Europe/Bucharest`. `Intl` alone is too lenient: it also takes offsets
 * (`+02:00`), abbreviations (`EST`) and any capitalisation, so the name must
 * look like one too. The name is not compared with what `Intl` resolves it
 * to: Node resolves current names to old ones (`Europe/Kyiv` to
 * `Europe/Kiev`), and a browser may list the current one.
 */
export function isIanaZone(zone: string): boolean {
  if (!ZONE_NAME.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** `YYYY-MM-DD`. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** `YYYY-MM-DDTHH:MM:SSZ`, the one instant form on the wire and the timed occurrence key. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** An instant (epoch ms) as `2026-10-16T07:00:00Z`: UTC, rounded down to the second. */
export function formatInstant(ms: number): string {
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Epoch ms of an ISO instant (`Z` or an offset). `NaN` when it is not one. */
export function parseInstant(iso: string): number {
  return Date.parse(iso);
}

/** `formatInstant` of what `value` parses to, or `undefined` when that is not an instant in the years 1-9999. */
function canonicalInstant(value: string): string | undefined {
  const ms = parseInstant(value);
  if (!Number.isFinite(ms)) return undefined;
  const instant = formatInstant(ms);
  return INSTANT.test(instant) && !instant.startsWith("0000") ? instant : undefined;
}

/** A real calendar date as `YYYY-MM-DD`. */
export const dateSchema = z.iso.date({ message: "must be a date as YYYY-MM-DD" });

/**
 * An ISO instant with `Z` or an offset (`2026-10-16T10:00:00+03:00`), turned
 * into `2026-10-16T07:00:00Z` (`formatInstant`). Years 0001-9999 in UTC.
 */
export const instantSchema = z.iso
  .datetime({ offset: true, message: "must be an ISO date and time with Z or an offset" })
  .transform((value, ctx) => {
    const instant = canonicalInstant(value);
    if (instant === undefined) {
      ctx.addIssue({ code: "custom", message: "must be a real time between the years 1 and 9999" });
      return z.NEVER;
    }
    return instant;
  });

/** An occurrence key: `2026-10-16T07:00:00Z` (timed) or `2026-10-16` (all-day), exactly. */
export const occurrenceKeySchema = z.string().refine(
  (value) =>
    (DATE.test(value) && dateSchema.safeParse(value).success) ||
    (INSTANT.test(value) && canonicalInstant(value) === value),
  { message: "must be an occurrence key: 2026-10-16T07:00:00Z, or 2026-10-16 for an all-day event" },
);
export type OccurrenceKey = z.infer<typeof occurrenceKeySchema>;

/** Whether an occurrence key (or a `start`) is a date, so the event is all-day. */
export function isDateKey(key: string): boolean {
  return DATE.test(key);
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(timeZone: string): Intl.DateTimeFormat {
  let format = dateFormats.get(timeZone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dateFormats.set(timeZone, format);
  }
  return format;
}

/** The date (`YYYY-MM-DD`) it is in `timeZone` at the instant `ms`. */
export function dateInZone(ms: number, timeZone: string): string {
  const parts = dateFormat(timeZone).formatToParts(ms);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

/** `date` moved by `days` (negative goes back). */
export function addDays(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const at = new Date(0);
  // setUTCFullYear, not Date.UTC, which reads years 0-99 as 1900-1999.
  at.setUTCFullYear(year, month - 1, day + days);
  return at.toISOString().slice(0, 10);
}

/** A run of whole days, `start` included and `end` not. */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * The days that overlap the instants `[from, to)` (epoch ms) in `timeZone`,
 * the user's display time zone. This is how an instant range (what the
 * browser asks for) meets all-day rows (which are dates): an all-day event
 * `[startDate, endDate)` overlaps the range exactly when
 * `startDate < range.end && endDate > range.start`.
 *
 * `start` is the date at `from`; `end` is the day after the date at the last
 * millisecond before `to`, so a `to` at midnight does not pull in the day it
 * starts. In Europe/Bucharest, 2026-10-15T21:00:00Z to 2026-10-16T21:00:00Z
 * (16 October, local midnight to midnight) is `{ start: "2026-10-16", end:
 * "2026-10-17" }`.
 */
export function allDayRange(from: number, to: number, timeZone: string): DateRange {
  return { start: dateInZone(from, timeZone), end: addDays(dateInZone(to - 1, timeZone), 1) };
}
