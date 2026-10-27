import { z } from "zod";
import { DAY_MS, MAX_RANGE_DAYS, dateInZone, dateSchema, instantSchema, occurrenceKeySchema, parseInstant } from "./time.js";

/**
 * Events, their repeats and their occurrences (corpus/wiki/glossary.md,
 * corpus/wiki/recurrence.md). These schemas are the API's contract; the
 * server's store maps them to the `events` table.
 *
 * Times follow `time.ts`: a timed event's `start` and `end` are instants
 * (`2026-10-16T07:00:00Z`), an all-day event's are dates with the end
 * exclusive (`2026-10-16` to `2026-10-17` is one day).
 */

/** RFC 5545's weekday codes, Monday first (weeks start on Monday). */
export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export const weekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof weekdaySchema>;

/** The repeat presets (corpus/wiki/recurrence.md). `weekdays` is Monday to Friday. */
export const REPEAT_FREQS = ["daily", "weekdays", "weekly", "monthly", "yearly"] as const;
export const repeatFreqSchema = z.enum(REPEAT_FREQS);
export type RepeatFreq = z.infer<typeof repeatFreqSchema>;

export const REPEAT_COUNT_MAX = 730;
/**
 * The last end date a repeat takes. A timed series' `UNTIL` is the end date's
 * last second in its zone, as UTC (`repeat.ts`): from a zone behind UTC,
 * 31 December 9999 would be in the year 10000, which no instant here can be.
 */
export const REPEAT_UNTIL_MAX = "9998-12-31";

/** How a series ends: never, after a date (inclusive, in the series' zone, at most `REPEAT_UNTIL_MAX`), or after a number of occurrences. */
export const repeatEndSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("never") }),
  z.strictObject({
    type: z.literal("until"),
    date: dateSchema.refine((date) => date <= REPEAT_UNTIL_MAX, { message: `must be on or before ${REPEAT_UNTIL_MAX}` }),
  }),
  z.strictObject({
    type: z.literal("count"),
    count: z
      .number()
      .int()
      .min(1, { message: `must be 1 to ${REPEAT_COUNT_MAX}` })
      .max(REPEAT_COUNT_MAX, { message: `must be 1 to ${REPEAT_COUNT_MAX}` }),
  }),
]);
export type RepeatEnd = z.infer<typeof repeatEndSchema>;

/**
 * A repeat preset. `byDay` is for `weekly` only: the days it repeats on, put
 * in week order without duplicates; left out, brief 04 repeats on the start's
 * weekday.
 */
export const repeatSchema = z
  .strictObject({
    freq: repeatFreqSchema,
    byDay: z
      .array(weekdaySchema)
      .min(1, { message: "pick at least one day" })
      .transform((days) => WEEKDAYS.filter((day) => days.includes(day)))
      .optional(),
    end: repeatEndSchema,
  })
  .superRefine((repeat, ctx) => {
    if (repeat.byDay !== undefined && repeat.freq !== "weekly") {
      ctx.addIssue({ code: "custom", path: ["byDay"], message: "is for a weekly repeat only" });
    }
  });
export type Repeat = z.infer<typeof repeatSchema>;

/** Which occurrences of a series an edit applies to (glossary: edit scope). One-off events ignore it. */
export const EDIT_SCOPES = ["this", "following", "all"] as const;
export const editScopeSchema = z.enum(EDIT_SCOPES);
export type EditScope = z.infer<typeof editScopeSchema>;

export const EVENT_TITLE_MAX = 200;
export const EVENT_LOCATION_MAX = 1000;
export const EVENT_NOTES_MAX = 20_000;
/**
 * The longest an event lasts, timed or all-day: ten years and a few days. A
 * series expands by looking back from a range by its length, so an event that
 * lasts to the year 9999 would break every range.
 */
export const EVENT_LENGTH_MAX_DAYS = 3660;

/**
 * An event's reminder (brief 15): how many minutes before the event starts its
 * notification goes, or null for none, the default. One per event. The
 * choices are what phone calendars offer.
 *
 * - A timed event counts back from its start.
 * - An all-day event counts back from 00:00 of its start date in the user's
 *   display time zone: 900 is 09:00 the day before, and -540 is 09:00 on the day.
 *
 * A series' reminder is every occurrence's; an exception carries its own.
 */
export const TIMED_REMINDERS = [0, 5, 10, 15, 30, 60, 120, 1440] as const;
export const ALL_DAY_REMINDERS = [-540, 900] as const;

/** The reminders an event of this kind can have, in the order the form lists them. */
export function remindersFor(allDay: boolean): readonly number[] {
  return allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS;
}

/** A reminder in words, for the form and the details: "10 minutes before", "the day before at 09:00". */
export function describeReminder(minutes: number, allDay: boolean): string {
  if (allDay) {
    // Minutes before 00:00 of the start date: whole days back, then the clock that day.
    const days = Math.ceil(minutes / 1440);
    const clock = days * 1440 - minutes;
    const time = `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
    const day = days === 0 ? "on the day" : days === 1 ? "the day before" : `${days} days before`;
    return `${day} at ${time}`;
  }
  if (minutes === 0) return "at the start";
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"} before`;
  if (minutes % 1440 === 0) return unit(minutes / 1440, "day");
  if (minutes % 60 === 0) return unit(minutes / 60, "hour");
  return unit(minutes, "minute");
}

const titleSchema = z
  .string({ error: "an event needs a title" })
  .trim()
  .min(1, { message: "an event needs a title" })
  .max(EVENT_TITLE_MAX, { message: `must be at most ${EVENT_TITLE_MAX} characters` });

/**
 * Every field of an event as a create sends it and a patch may change it.
 * `start` and `end` are strings here; what they must be depends on `allDay`,
 * which `settleTimes` checks once the whole event is known.
 */
const eventFields = {
  calendarId: z.number({ error: "must be a calendar id" }).int().positive({ message: "must be a calendar id" }),
  title: titleSchema,
  location: z
    .string()
    .trim()
    .max(EVENT_LOCATION_MAX, { message: `must be at most ${EVENT_LOCATION_MAX} characters` }),
  notes: z
    .string()
    .trim()
    .max(EVENT_NOTES_MAX, { message: `must be at most ${EVENT_NOTES_MAX} characters` }),
  allDay: z.boolean(),
  start: z.string(),
  end: z.string(),
  repeat: repeatSchema.nullable(),
  reminderMinutes: z.number({ error: "must be a number of minutes, or null for none" }).int().nullable(),
};

/**
 * Checks `start` and `end` against `allDay` and turns them into the wire
 * forms: instants for a timed event (any offset in, `…Z` out), dates for an
 * all-day one. The end must be after the start; for all-day that means at
 * least one day, the end being exclusive. And at most
 * `EVENT_LENGTH_MAX_DAYS` after it.
 */
function settleTimes<T extends { allDay: boolean; start: string; end: string; reminderMinutes: number | null }>(
  value: T,
  ctx: z.RefinementCtx,
): T {
  if (value.reminderMinutes !== null && !remindersFor(value.allDay).includes(value.reminderMinutes)) {
    const choices = remindersFor(value.allDay).join(", ");
    ctx.addIssue({
      code: "custom",
      path: ["reminderMinutes"],
      message: `must be null or one of ${choices} for ${value.allDay ? "an all-day" : "a timed"} event`,
    });
  }
  const parser = value.allDay ? dateSchema : instantSchema;
  const what = value.allDay
    ? "must be a date as YYYY-MM-DD for an all-day event"
    : "must be an ISO date and time with Z or an offset, such as 2026-10-16T10:00:00+03:00";
  const start = parser.safeParse(value.start);
  const end = parser.safeParse(value.end);
  if (!start.success) ctx.addIssue({ code: "custom", path: ["start"], message: what });
  if (!end.success) ctx.addIssue({ code: "custom", path: ["end"], message: what });
  if (!start.success || !end.success) return z.NEVER;
  // Both are in one fixed-width form, so the strings order as the times do.
  if (end.data <= start.data) {
    ctx.addIssue({ code: "custom", path: ["end"], message: "must be after the start" });
    return z.NEVER;
  }
  // A date parses as its midnight in UTC, so both kinds measure the same way.
  if (parseInstant(end.data) - parseInstant(start.data) > EVENT_LENGTH_MAX_DAYS * DAY_MS) {
    ctx.addIssue({ code: "custom", path: ["end"], message: `must be at most ${EVENT_LENGTH_MAX_DAYS} days after the start` });
    return z.NEVER;
  }
  return { ...value, start: start.data, end: end.data };
}

/**
 * `POST /api/events`, and what a patch's changes must add up to. Left out,
 * `location` and `notes` are empty, `repeat` is null (does not repeat) and
 * `reminderMinutes` is null (no reminder). A reminder must be one of
 * `remindersFor` the event's kind.
 */
export const eventInputSchema = z
  .strictObject({
    ...eventFields,
    location: eventFields.location.default(""),
    notes: eventFields.notes.default(""),
    repeat: eventFields.repeat.default(null),
    reminderMinutes: eventFields.reminderMinutes.default(null),
  })
  .transform(settleTimes);
export type EventInput = z.infer<typeof eventInputSchema>;

/**
 * The changes of a patch: any of the input's fields. They are checked as a
 * whole once merged onto the stored event (`eventInputSchema`), so a new
 * `end` alone must still be after the stored start, and turning an event
 * all-day needs dates for both `start` and `end`. Turning it all-day or timed
 * without a `reminderMinutes` resets the reminder to none: the two kinds have
 * different choices.
 */
export const eventChangesSchema = z.strictObject(eventFields).partial();
export type EventChanges = z.infer<typeof eventChangesSchema>;

/**
 * `PATCH /api/events/:id`. `id` is the occurrence's `eventId`. For an
 * occurrence of a series, `scope` says which occurrences change and
 * `occurrence` (its `originalStart`) which one this is (brief 04). A one-off
 * event ignores both.
 */
export const eventPatchSchema = z.strictObject({
  scope: editScopeSchema.optional(),
  occurrence: occurrenceKeySchema.optional(),
  changes: eventChangesSchema,
});
export type EventPatch = z.infer<typeof eventPatchSchema>;

/** `DELETE /api/events/:id?scope&occurrence`, the query. As the patch: a one-off event ignores both. */
export const eventDeleteQuerySchema = z.object({
  scope: editScopeSchema.optional(),
  occurrence: occurrenceKeySchema.optional(),
});
export type EventDeleteQuery = z.infer<typeof eventDeleteQuerySchema>;

/**
 * One occurrence, as the views, search and the event writes answer it.
 *
 * - A stored row (a one-off event, or an exception of a series): `id` is
 *   `e<eventId>`.
 * - An occurrence generated from a series (brief 04): `id` is
 *   `s<seriesId>:<key>`, and `eventId` is the series' id.
 *
 * `seriesId` and `originalStart` (the occurrence key) are set for both kinds
 * that belong to a series and null for a one-off. `repeat` is the series'
 * repeat, null for a one-off.
 */
export const occurrenceSchema = z.object({
  /** Stable across requests, so a view can key on it. */
  id: z.string(),
  /** The row a `PATCH` or `DELETE /api/events/:id` takes. */
  eventId: z.number().int().positive(),
  seriesId: z.number().int().positive().nullable(),
  originalStart: occurrenceKeySchema.nullable(),
  calendarId: z.number().int().positive(),
  title: z.string(),
  location: z.string(),
  notes: z.string(),
  allDay: z.boolean(),
  /** `…Z` instants for a timed occurrence, dates (end exclusive) for an all-day one. */
  start: occurrenceKeySchema,
  end: occurrenceKeySchema,
  repeat: repeatSchema.nullable(),
  /** The reminder (`TIMED_REMINDERS`, `ALL_DAY_REMINDERS`), or null for none. A generated occurrence has the series'. */
  reminderMinutes: z.number().int().nullable(),
});
export type Occurrence = z.infer<typeof occurrenceSchema>;

/** `GET /api/occurrences`: the occurrences overlapping the range, by start (`compareOccurrences`). */
export const occurrenceListSchema = z.object({ occurrences: z.array(occurrenceSchema) });
export type OccurrenceList = z.infer<typeof occurrenceListSchema>;

/** A query string decodes an unescaped `+` as a space; no instant has a space, so it was a `+`. */
const queryInstant = z.preprocess(
  (value) => (typeof value === "string" ? value.replaceAll(" ", "+") : value),
  instantSchema,
);

/**
 * `GET /api/occurrences?from&to`: ISO instants, `to` after `from`, at most
 * `MAX_RANGE_DAYS` apart. All-day events are matched on the dates the range
 * covers in the user's display time zone (`allDayRange`).
 */
export const occurrenceQuerySchema = z
  .object({ from: queryInstant, to: queryInstant })
  .superRefine(({ from, to }, ctx) => {
    const span = parseInstant(to) - parseInstant(from);
    if (span <= 0) ctx.addIssue({ code: "custom", path: ["to"], message: "must be after from" });
    else if (span > MAX_RANGE_DAYS * DAY_MS) {
      ctx.addIssue({ code: "custom", path: ["to"], message: `must be at most ${MAX_RANGE_DAYS} days after from` });
    }
  });
export type OccurrenceQuery = z.infer<typeof occurrenceQuerySchema>;

/** The `id` of a stored row's occurrence: `e12`. */
export function eventOccurrenceId(eventId: number): string {
  return `e${eventId}`;
}

/** The `id` of an occurrence generated from a series: `s7:2026-10-16T07:00:00Z`. */
export function seriesOccurrenceId(seriesId: number, key: string): string {
  return `s${seriesId}:${key}`;
}

export type ParsedOccurrenceId = { kind: "event"; eventId: number } | { kind: "series"; seriesId: number; key: string };

/** What an occurrence `id` names, or `undefined` when it is not one. */
export function parseOccurrenceId(id: string): ParsedOccurrenceId | undefined {
  const row = /^e([1-9]\d{0,15})$/.exec(id);
  if (row) return { kind: "event", eventId: Number(row[1]) };
  const generated = /^s([1-9]\d{0,15}):(.+)$/.exec(id);
  if (generated && occurrenceKeySchema.safeParse(generated[2]).success) {
    return { kind: "series", seriesId: Number(generated[1]), key: generated[2] ?? "" };
  }
  return undefined;
}

/** The date an occurrence starts on in `timeZone`. */
export function occurrenceDate(occurrence: Pick<Occurrence, "allDay" | "start">, timeZone: string): string {
  return occurrence.allDay ? occurrence.start : dateInZone(parseInstant(occurrence.start), timeZone);
}

/**
 * Orders occurrences by start as a day view lists them, in `timeZone`: by the
 * date they start on, all-day ones first that day, then by start time, the
 * longer one first, then by `id` so the order is stable.
 */
export function compareOccurrences(timeZone: string): (a: Occurrence, b: Occurrence) => number {
  const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  // A sort asks for each occurrence's date many times; Intl is the slow part.
  const dates = new Map<string, string>();
  const date = (occurrence: Occurrence) => {
    let found = dates.get(occurrence.start);
    if (found === undefined) {
      found = occurrenceDate(occurrence, timeZone);
      dates.set(occurrence.start, found);
    }
    return found;
  };
  return (a, b) =>
    cmp(date(a), date(b)) ||
    Number(b.allDay) - Number(a.allDay) ||
    cmp(a.start, b.start) ||
    cmp(b.end, a.end) ||
    cmp(a.id, b.id);
}
