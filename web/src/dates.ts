import { Temporal } from "temporal-polyfill";

/**
 * Dates for the views, with Temporal (`temporal-polyfill`). Every name,
 * number and separator is written here in English, so nothing depends on the
 * machine's locale: no `toLocaleString`, no `Intl` defaults.
 *
 * - "Today" is always in the display time zone (corpus/wiki/glossary.md),
 *   never the device's: `todayIn(timeZone)`.
 * - Weeks start on Monday.
 * - A span of days is `{ start, end }` with `end` exclusive, like the API's
 *   all-day dates.
 * - 24-hour times ("14:30"), dates as "16 Oct 2026", day headings as
 *   "Friday, 16 October", range titles as Google writes them.
 */

export { Temporal };

// --- Views -------------------------------------------------------------------------

/** The four ways to look at time (glossary: view). */
export type View = "day" | "week" | "month" | "year";

/** The views FullCalendar draws (brief 06); the year view is our own. */
export type CalendarView = Exclude<View, "year">;

export const VIEWS: readonly View[] = ["day", "week", "month", "year"];

/** What the view switcher calls each view. */
export const VIEW_LABELS: Readonly<Record<View, string>> = { day: "Day", week: "Week", month: "Month", year: "Year" };

/** The view the app opens on (corpus/wiki/features.md). */
export const DEFAULT_VIEW: View = "month";

export function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

// --- Names -------------------------------------------------------------------------

export const MONTH_NAMES = [
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

/** Three letters each, "Sep" included. */
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Monday first: index `dayOfWeek - 1` (Temporal's Monday is 1, Sunday 7). */
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
/** The mini-month's column heads. */
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Temporal's `dayOfWeek` (Monday 1 … Sunday 7). */
export const WEEK_STARTS_ON = 1;

/** "October". */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

/** "Oct". */
export function monthShort(month: number): string {
  return MONTH_SHORT[month - 1] ?? "";
}

/** "Friday", from Temporal's `dayOfWeek`. */
export function weekdayName(dayOfWeek: number): string {
  return WEEKDAY_NAMES[dayOfWeek - 1] ?? "";
}

/** "Fri". */
export function weekdayShort(dayOfWeek: number): string {
  return WEEKDAY_SHORT[dayOfWeek - 1] ?? "";
}

// --- Today and instants --------------------------------------------------------------

/** The date it is now in `timeZone`. `now` is for tests. */
export function todayIn(timeZone: string, now: Temporal.Instant = Temporal.Now.instant()): Temporal.PlainDate {
  return now.toZonedDateTimeISO(timeZone).toPlainDate();
}

/** A wire instant (`2026-10-16T07:00:00Z`) on the clock of `timeZone`. */
export function zonedOf(instant: string, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
}

/** A Temporal instant in the wire's form: UTC, whole seconds, `Z`. */
export function wireInstant(instant: Temporal.Instant): string {
  return instant.round({ smallestUnit: "second", roundingMode: "floor" }).toString({ smallestUnit: "second" });
}

/**
 * A span of days as the instants the API asks for: local midnight to local
 * midnight in `timeZone` (start of day, so a day that starts with a DST gap
 * still begins at its first real instant). For `GET /api/occurrences`.
 */
export function instantRange(span: DateSpan, timeZone: string): { from: string; to: string } {
  return {
    from: wireInstant(span.start.toZonedDateTime({ timeZone }).toInstant()),
    to: wireInstant(span.end.toZonedDateTime({ timeZone }).toInstant()),
  };
}

// --- Dates as text keys ----------------------------------------------------------------

/** `2026-10-16`: the API's all-day form, and the key `MonthGrid`'s `marked` set holds. */
export function dateKey(date: Temporal.PlainDate): string {
  return date.toString();
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real date from `YYYY-MM-DD`, or `null`. */
export function parseDateKey(key: string): Temporal.PlainDate | null {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  return dateFrom(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** A real date in the years 1-9999, or `null` (31 February, month 13, year 0). */
export function dateFrom(year: number, month: number, day: number): Temporal.PlainDate | null {
  if (![year, month, day].every(Number.isInteger) || year < 1 || year > 9999) return null;
  try {
    return Temporal.PlainDate.from({ year, month, day }, { overflow: "reject" });
  } catch {
    return null;
  }
}

export function sameDate(a: Temporal.PlainDate, b: Temporal.PlainDate): boolean {
  return Temporal.PlainDate.compare(a, b) === 0;
}

// --- Spans -------------------------------------------------------------------------------

/** Whole days, `start` included, `end` not. */
export interface DateSpan {
  start: Temporal.PlainDate;
  end: Temporal.PlainDate;
}

/** The Monday on or before `date`. */
export function startOfWeek(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.subtract({ days: (date.dayOfWeek - WEEK_STARTS_ON + 7) % 7 });
}

/**
 * The days a view shows around `date`:
 *
 * - day: that day;
 * - week: Monday to Sunday;
 * - month: the whole weeks that hold the month, Monday on or before the 1st
 *   to the Sunday on or after the last day (4 to 6 weeks; FullCalendar's
 *   `fixedWeekCount: false`). `MonthGrid` always draws 6 rows instead;
 * - year: 1 January to 1 January.
 */
export function visibleRange(view: View, date: Temporal.PlainDate): DateSpan {
  switch (view) {
    case "day":
      return { start: date, end: date.add({ days: 1 }) };
    case "week": {
      const start = startOfWeek(date);
      return { start, end: start.add({ days: 7 }) };
    }
    case "month": {
      const first = date.with({ day: 1 });
      const last = first.add({ months: 1 }).subtract({ days: 1 });
      return { start: startOfWeek(first), end: startOfWeek(last).add({ days: 7 }) };
    }
    case "year": {
      const start = date.with({ month: 1, day: 1 });
      return { start, end: start.add({ years: 1 }) };
    }
  }
}

/** Every date of a span, in order. */
export function datesOf(span: DateSpan): Temporal.PlainDate[] {
  const dates: Temporal.PlainDate[] = [];
  for (let day = span.start; Temporal.PlainDate.compare(day, span.end) < 0; day = day.add({ days: 1 })) dates.push(day);
  return dates;
}

/** The weeks `MonthGrid` draws for a month: `weeks` rows (6 by default) of 7 dates, Monday first, from the week of the 1st. */
export function monthWeeks(month: Temporal.PlainYearMonth, weeks = 6): Temporal.PlainDate[][] {
  const start = startOfWeek(month.toPlainDate({ day: 1 }));
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => start.add({ days: week * 7 + day })),
  );
}

// --- Stepping -----------------------------------------------------------------------------

/**
 * `date` moved by `by` of the view's own unit: days, weeks, months or years.
 * A month or year step keeps the day where it can and clamps it where it
 * can't: 31 January plus one month is 28 February (29 in a leap year).
 */
export function stepDate(view: View, date: Temporal.PlainDate, by: number): Temporal.PlainDate {
  switch (view) {
    case "day":
      return date.add({ days: by });
    case "week":
      return date.add({ weeks: by });
    case "month":
      return date.add({ months: by }, { overflow: "constrain" });
    case "year":
      return date.add({ years: by }, { overflow: "constrain" });
  }
}

// --- Text -------------------------------------------------------------------------------------

/** The separator in a range, an en dash with spaces: "19 – 25 Oct 2026". */
export const RANGE_DASH = " – ";

/**
 * The top bar's title for a view at `date`, as Google writes it:
 *
 * - day: "16 October 2026"
 * - week: "19 – 25 Oct 2026"; across months "Oct – Nov 2026"; across years "Dec 2026 – Jan 2027"
 * - month: "October 2026"
 * - year: "2026"
 */
export function rangeTitle(view: View, date: Temporal.PlainDate): string {
  switch (view) {
    case "day":
      return `${date.day} ${monthName(date.month)} ${date.year}`;
    case "week": {
      const { start, end } = visibleRange("week", date);
      const last = end.subtract({ days: 1 });
      if (start.year !== last.year) {
        return `${monthShort(start.month)} ${start.year}${RANGE_DASH}${monthShort(last.month)} ${last.year}`;
      }
      if (start.month !== last.month) return `${monthShort(start.month)}${RANGE_DASH}${monthShort(last.month)} ${last.year}`;
      return `${start.day}${RANGE_DASH}${last.day} ${monthShort(last.month)} ${last.year}`;
    }
    case "month":
      return monthTitle(date);
    case "year":
      return String(date.year);
  }
}

/**
 * `rangeTitle` short enough for the phone's bar, which keeps the year: "16 Oct 2026";
 * a week by its month, as Google's phone app writes it, "Oct 2026", "Oct–Nov 2026",
 * "Dec ’26–Jan ’27"; "Oct 2026"; "2026".
 */
export function rangeTitleShort(view: View, date: Temporal.PlainDate): string {
  switch (view) {
    case "day":
      return formatDate(date);
    case "week": {
      const { start, end } = visibleRange("week", date);
      const last = end.subtract({ days: 1 });
      if (start.year !== last.year) return `${monthShort(start.month)} ’${yy(start.year)}–${monthShort(last.month)} ’${yy(last.year)}`;
      if (start.month !== last.month) return `${monthShort(start.month)}–${monthShort(last.month)} ${last.year}`;
      return `${monthShort(last.month)} ${last.year}`;
    }
    case "month":
      return `${monthShort(date.month)} ${date.year}`;
    case "year":
      return String(date.year);
  }
}

function yy(year: number): string {
  return String(year % 100).padStart(2, "0");
}

/** "October 2026", for a date or a year-month. */
export function monthTitle(month: { year: number; month: number }): string {
  return `${monthName(month.month)} ${month.year}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 24-hour "14:30", "09:05"; from a PlainTime, PlainDateTime or ZonedDateTime. */
export function formatTime(time: { readonly hour: number; readonly minute: number }): string {
  return `${pad2(time.hour)}:${pad2(time.minute)}`;
}

/** "16 Oct 2026". */
export function formatDate(date: { readonly year: number; readonly month: number; readonly day: number }): string {
  return `${date.day} ${monthShort(date.month)} ${date.year}`;
}

/** "Friday, 16 October": a day's heading, without the year. */
export function formatDayLong(date: { readonly dayOfWeek: number; readonly month: number; readonly day: number }): string {
  return `${weekdayName(date.dayOfWeek)}, ${date.day} ${monthName(date.month)}`;
}

/** "Friday, 16 October 2026": a day button's accessible name. */
export function formatDayFull(date: Temporal.PlainDate): string {
  return `${formatDayLong(date)} ${date.year}`;
}
