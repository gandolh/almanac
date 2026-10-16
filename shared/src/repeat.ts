import { WEEKDAYS, type Repeat, type RepeatEnd, type Weekday } from "./event.js";
import { DAY_MS, dateInZone, isDateKey, parseInstant } from "./time.js";

/**
 * Repeats as RRULEs, and as the text the event form and the details popover
 * show (corpus/wiki/recurrence.md). Plain `Intl` and `Date` maths, as in
 * `time.ts`: the server expands rules with rrule-temporal, but turning a
 * preset into a rule and back needs no Temporal.
 *
 * All three functions take the event's `start` as the API sends it (an
 * instant `2026-10-15T21:30:00Z`, or a date `2026-10-16` for an all-day
 * event) and the zone its wall-clock times belong to: the series' `tzid` on
 * the server, the display time zone in the browser. A date ignores the zone.
 * The date the start falls on in that zone is what the presets follow: the
 * instant above is 16 October 00:30 in Europe/Bucharest, so a monthly repeat
 * from it is on day 16.
 *
 * The rules are the RRULE value without the `RRULE:` name, as the `events`
 * table stores it. The parts are always written in this order:
 *
 * | Preset   | Rule                                   |
 * |----------|----------------------------------------|
 * | daily    | `FREQ=DAILY`                           |
 * | weekdays | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`     |
 * | weekly   | `FREQ=WEEKLY;BYDAY=MO,WE` (the start's weekday when `byDay` is left out) |
 * | monthly  | `FREQ=MONTHLY;BYMONTHDAY=16`           |
 * | yearly   | `FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=16` |
 *
 * then `;UNTIL=…` or `;COUNT=10`. The day parts are spelled out, although
 * RFC 5545 would take them from DTSTART, so a rule says what it does on its
 * own after an edit moves its start.
 *
 * `UNTIL` follows RFC 5545 3.3.10: for a timed series (a DTSTART with a TZID)
 * it is a UTC date-time, the last second of the end date in the series' zone
 * (`20261201T215959Z` for 1 December in Bucharest), so every occurrence on
 * that date is in; for an all-day series it is the date (`20261201`).
 */

const WORKDAYS: readonly Weekday[] = ["MO", "TU", "WE", "TH", "FR"];

const WEEKDAY_NAMES: Record<Weekday, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The date (`YYYY-MM-DD`) a start falls on in `timeZone`: a date as it is, an instant converted. */
export function startDate(start: string, timeZone: string): string {
  return isDateKey(start) ? start : dateInZone(parseInstant(start), timeZone);
}

function dateParts(date: string): { year: number; month: number; day: number } {
  const [year = 1, month = 1, day = 1] = date.split("-").map(Number);
  return { year, month, day };
}

/** The weekday of a date (`YYYY-MM-DD`), as RFC 5545 names it. */
export function weekdayOf(date: string): Weekday {
  const { year, month, day } = dateParts(date);
  const at = new Date(0);
  at.setUTCFullYear(year, month - 1, day);
  // getUTCDay counts from Sunday; WEEKDAYS from Monday.
  return WEEKDAYS[(at.getUTCDay() + 6) % 7] ?? "MO";
}

/** The days a weekly repeat is on: `byDay` in week order, or the start's weekday. */
function weeklyDays(repeat: Repeat, date: string): Weekday[] {
  return repeat.byDay !== undefined && repeat.byDay.length > 0
    ? WEEKDAYS.filter((day) => repeat.byDay?.includes(day))
    : [weekdayOf(date)];
}

const wallFormats = new Map<string, Intl.DateTimeFormat>();

/** What the wall clock in `timeZone` shows at the instant `ms`, as epoch ms of that reading taken as UTC. */
function wallClock(ms: number, timeZone: string): number {
  let format = wallFormats.get(timeZone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    wallFormats.set(timeZone, format);
  }
  const parts = format.formatToParts(ms);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const at = new Date(0);
  // setUTCFullYear, not Date.UTC, which reads years 0-99 as 1900-1999.
  at.setUTCFullYear(part("year"), part("month") - 1, part("day"));
  at.setUTCHours(part("hour"), part("minute"), part("second"), 0);
  return at.getTime();
}

/**
 * The instant the wall clock in `timeZone` shows `wall` (epoch ms of the
 * reading taken as UTC). When the clock shows it twice (summer time ending),
 * the later; when never (a gap), the moment the gap ends.
 */
function instantOfWallClock(wall: number, timeZone: string): number {
  // The offsets a day either side cover any change of offset near `wall`.
  const before = wallClock(wall - DAY_MS, timeZone) - (wall - DAY_MS);
  const after = wallClock(wall + DAY_MS, timeZone) - (wall + DAY_MS);
  const fits = [wall - before, wall - after].filter((ms) => wallClock(ms, timeZone) === wall);
  return fits.length > 0 ? Math.max(...fits) : wall - before;
}

/** `20261201T215959Z`: the last second of `date` in `timeZone`, in UTC. */
function untilInstant(date: string, timeZone: string): string {
  const { year, month, day } = dateParts(date);
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(23, 59, 59, 0);
  const iso = new Date(instantOfWallClock(wall.getTime(), timeZone)).toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

function endPart(end: RepeatEnd, allDay: boolean, timeZone: string): string {
  switch (end.type) {
    case "never":
      return "";
    case "count":
      return `;COUNT=${end.count}`;
    case "until":
      return `;UNTIL=${allDay ? end.date.replaceAll("-", "") : untilInstant(end.date, timeZone)}`;
  }
}

/**
 * The RRULE for a repeat starting at `start` (an instant, or a date for an
 * all-day series) in `timeZone`, the series' zone. Weekly without `byDay`
 * repeats on the start's weekday; monthly on the start's day of the month;
 * yearly on the start's date. See the table at the top of this file.
 *
 *     repeatToRRule({ freq: "weekly", end: { type: "count", count: 10 } }, "2026-10-19T07:00:00Z", "Europe/Bucharest")
 *     // "FREQ=WEEKLY;BYDAY=MO;COUNT=10"
 */
export function repeatToRRule(repeat: Repeat, start: string, timeZone: string): string {
  const date = startDate(start, timeZone);
  const { month, day } = dateParts(date);
  const rule = {
    daily: () => "FREQ=DAILY",
    weekdays: () => `FREQ=WEEKLY;BYDAY=${WORKDAYS.join(",")}`,
    weekly: () => `FREQ=WEEKLY;BYDAY=${weeklyDays(repeat, date).join(",")}`,
    monthly: () => `FREQ=MONTHLY;BYMONTHDAY=${day}`,
    yearly: () => `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${day}`,
  }[repeat.freq]();
  return rule + endPart(repeat.end, isDateKey(start), timeZone);
}

const UNTIL_DATE = /^(\d{4})(\d{2})(\d{2})$/;
const UNTIL_INSTANT = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
const DAY_LIST = /^(?:MO|TU|WE|TH|FR|SA|SU)(?:,(?:MO|TU|WE|TH|FR|SA|SU))*$/;

/** A positive whole number written plainly, or `undefined`. */
function plainNumber(value: string | undefined): number | undefined {
  return value !== undefined && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : undefined;
}

/**
 * The repeat a stored RRULE is: the inverse of `repeatToRRule`, given the
 * same `start` and `timeZone`. A weekly rule always comes back with `byDay`
 * (the start's weekday when the rule has no `BYDAY`), and a weekly rule on
 * Monday to Friday comes back as `weekdays`. A `BYMONTHDAY` or `BYMONTH`
 * that is not the start's is ignored: the presets follow the start. A UTC
 * `UNTIL` comes back as the date it falls on in `timeZone`.
 *
 * Throws for a rule that is not one of the presets (an `INTERVAL`, an
 * unknown part): Almanac only stores rules `repeatToRRule` wrote.
 */
export function rruleToRepeat(rrule: string, start: string, timeZone: string): Repeat {
  const parts = new Map<string, string>();
  for (const part of rrule.replace(/^RRULE:/, "").split(";")) {
    const [name = "", value = "", ...rest] = part.split("=");
    if (rest.length > 0 || parts.has(name)) throw new Error(`Not a repeat preset: ${rrule}`);
    parts.set(name, value);
  }
  const known = new Set(["FREQ", "BYDAY", "BYMONTHDAY", "BYMONTH", "UNTIL", "COUNT"]);
  if ([...parts.keys()].some((name) => !known.has(name))) throw new Error(`Not a repeat preset: ${rrule}`);

  let end: RepeatEnd = { type: "never" };
  const until = parts.get("UNTIL");
  const count = parts.get("COUNT");
  if (until !== undefined && count !== undefined) throw new Error(`Not a repeat preset: ${rrule}`);
  if (count !== undefined) {
    const n = plainNumber(count);
    if (n === undefined) throw new Error(`Not a repeat preset: ${rrule}`);
    end = { type: "count", count: n };
  } else if (until !== undefined) {
    const asDate = UNTIL_DATE.exec(until);
    const asInstant = UNTIL_INSTANT.exec(until);
    if (asDate) end = { type: "until", date: `${asDate[1]}-${asDate[2]}-${asDate[3]}` };
    else if (asInstant) {
      const [, y, mo, d, h, mi, s] = asInstant;
      end = { type: "until", date: dateInZone(parseInstant(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`), timeZone) };
    } else throw new Error(`Not a repeat preset: ${rrule}`);
  }

  const byDay = parts.get("BYDAY");
  if (byDay !== undefined && !DAY_LIST.test(byDay)) throw new Error(`Not a repeat preset: ${rrule}`);
  const freq = parts.get("FREQ");
  if (freq !== "WEEKLY" && byDay !== undefined) throw new Error(`Not a repeat preset: ${rrule}`);
  switch (freq) {
    case "DAILY":
      return { freq: "daily", end };
    case "WEEKLY": {
      const days = byDay === undefined ? [weekdayOf(startDate(start, timeZone))] : (byDay.split(",") as Weekday[]);
      const ordered = WEEKDAYS.filter((day) => days.includes(day));
      if (ordered.join(",") === WORKDAYS.join(",")) return { freq: "weekdays", end };
      return { freq: "weekly", byDay: ordered, end };
    }
    case "MONTHLY":
      return { freq: "monthly", end };
    case "YEARLY":
      return { freq: "yearly", end };
    default:
      throw new Error(`Not a repeat preset: ${rrule}`);
  }
}

/** `1 Dec 2026`. */
function shortDate(date: string): string {
  const { year, month, day } = dateParts(date);
  return `${day} ${MONTH_NAMES[month - 1]?.slice(0, 3)} ${year}`;
}

/**
 * The repeat as the UI says it, for a series starting at `start` in
 * `timeZone` (see the top of this file; pass an occurrence's
 * `originalStart ?? start` and the display time zone):
 *
 * - "Daily"
 * - "Every weekday (Monday to Friday)"
 * - "Weekly on Monday, Wednesday" (the start's weekday when `byDay` is left out)
 * - "Monthly on day 16"
 * - "Annually on 16 October"
 *
 * followed by ", until 1 Dec 2026" or ", 10 times" ("1 time") when it ends.
 */
export function describeRepeat(repeat: Repeat, start: string, timeZone: string): string {
  const date = startDate(start, timeZone);
  const { month, day } = dateParts(date);
  const what = {
    daily: () => "Daily",
    weekdays: () => "Every weekday (Monday to Friday)",
    weekly: () => `Weekly on ${weeklyDays(repeat, date).map((d) => WEEKDAY_NAMES[d]).join(", ")}`,
    monthly: () => `Monthly on day ${day}`,
    yearly: () => `Annually on ${day} ${MONTH_NAMES[month - 1]}`,
  }[repeat.freq]();
  switch (repeat.end.type) {
    case "never":
      return what;
    case "until":
      return `${what}, until ${shortDate(repeat.end.date)}`;
    case "count":
      return `${what}, ${repeat.end.count} ${repeat.end.count === 1 ? "time" : "times"}`;
  }
}
