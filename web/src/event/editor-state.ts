import {
  EVENT_LOCATION_MAX,
  EVENT_NOTES_MAX,
  EVENT_TITLE_MAX,
  REPEAT_COUNT_MAX,
  WEEKDAYS,
  describeRepeat,
  isDateKey,
  startDate as seriesStartDate,
  type Calendar,
  type Occurrence,
  type Repeat,
  type RepeatFreq,
  type Weekday,
} from "@almanac/shared";
import { displayTitle } from "../calendar/events";
import type { EventInputBody, EventPatchBody } from "../data/occurrences";
import { Temporal, formatTime, parseDateKey, todayIn, wireInstant, zonedOf } from "../dates";
import type { AskScopeOptions } from "./scope";

/**
 * What the event form and quick create decide, as plain functions so the
 * tests can run them in Node: the form's draft, its defaults, how a start
 * moves the end, time text, the repeat presets, what is wrong with a draft,
 * what to send, and which fields of an edit count as changed.
 *
 * A draft holds what the fields show, as text: dates `YYYY-MM-DD` (empty
 * while a date field is half typed), times `HH:MM`, all in the display time
 * zone's wall clock. The zone only matters when a draft is turned into wire
 * instants (`wireTimesOf`) or made from them.
 */

export { EVENT_LOCATION_MAX, EVENT_NOTES_MAX, EVENT_TITLE_MAX, REPEAT_COUNT_MAX };

// --- The draft ---------------------------------------------------------------------------

/** The choices of the repeat picker (`repeatOptions` words them, in its order). */
export type RepeatPreset = "none" | "daily" | "weekly" | "weekdays" | "monthly" | "yearly" | "custom";

/** How a repeat ends: never, on a date, or after a number of times. */
export type RepeatEndKind = "never" | "until" | "count";

/** The repeat picker's state. `until` and `count` are kept as typed, and both kept while the other is chosen. */
export interface RepeatDraft {
  preset: RepeatPreset;
  /** The days of "Custom days…", in week order, never empty. */
  days: Weekday[];
  end: RepeatEndKind;
  /** `YYYY-MM-DD`, or empty. */
  until: string;
  count: string;
}

export interface EventDraft {
  title: string;
  /** `null` until the calendars are known: the form then takes the default one. */
  calendarId: number | null;
  allDay: boolean;
  startDate: string;
  startTime: string;
  /** For an all-day event the last day, inclusive (the wire's end is the day after). */
  endDate: string;
  endTime: string;
  repeat: RepeatDraft;
  /** Whether the user has used the repeat picker; until then an edit leaves the repeat alone. */
  repeatTouched: boolean;
  /** The repeat the edited occurrence had, and the date it was anchored to; `null` for a new event. */
  origin: { repeat: Repeat | null; anchor: string } | null;
  location: string;
  notes: string;
}

/** What a new event's form starts from: `CreateInit`, and what quick create had typed. */
export interface FormSeed {
  /** A `…Z` instant, or `YYYY-MM-DD`. */
  start?: string;
  end?: string;
  allDay?: boolean;
  title?: string;
  calendarId?: number | null;
}

// --- Dates and times ----------------------------------------------------------------------

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTime(text: string): Temporal.PlainTime | null {
  const match = TIME.exec(text);
  return match ? Temporal.PlainTime.from({ hour: Number(match[1]), minute: Number(match[2]) }) : null;
}

/** A date and a time as the fields hold them, or `null` when either is not valid. */
function dateTimeOf(date: string, time: string): Temporal.PlainDateTime | null {
  const day = parseDateKey(date);
  const clock = parseTime(time);
  return day && clock ? day.toPlainDateTime(clock) : null;
}

function startOf(draft: EventDraft): Temporal.PlainDateTime | null {
  return draft.allDay ? dateTimeOf(draft.startDate, "00:00") : dateTimeOf(draft.startDate, draft.startTime);
}

function endOf(draft: EventDraft): Temporal.PlainDateTime | null {
  return draft.allDay ? dateTimeOf(draft.endDate, "00:00") : dateTimeOf(draft.endDate, draft.endTime);
}

function minutesBetween(from: Temporal.PlainDateTime, to: Temporal.PlainDateTime): number {
  return Math.round(from.until(to, { largestUnit: "minute" }).total("minute"));
}

/**
 * What a typed time means: "14:30", "1430", "930", "9:30", "9.30" or just
 * "14" (an hour). Returns "HH:MM", or `null` when it is no time of day.
 */
export function parseTimeText(text: string): string | null {
  const match = /^\s*(\d{1,2})(?:[:.]?(\d{2}))?\s*$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (hour > 23 || minute > 59) return null;
  return formatTime({ hour, minute });
}

/** "15 mins", "1 hr", "1.5 hrs", "1.25 hrs": how long, for the end time's list. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return minutes === 1 ? "1 min" : `${minutes} mins`;
  const hours = Number((minutes / 60).toFixed(2));
  return hours === 1 ? "1 hr" : `${hours} hrs`;
}

export interface TimeOption {
  /** "14:30" */
  value: string;
  /** What the list shows: "14:30", or "15:30 (1 hr)" in the end time's list. */
  label: string;
}

/** Every 15 minutes of a day, 24-hour. */
const TIME_STEP = 15;

function slots(): string[] {
  const all: string[] = [];
  for (let minute = 0; minute < 24 * 60; minute += TIME_STEP) {
    all.push(formatTime({ hour: Math.floor(minute / 60), minute: minute % 60 }));
  }
  return all;
}

const SLOTS = slots();

/** The start time's list: every 15 minutes, "00:00" to "23:45". */
export function startTimeOptions(): TimeOption[] {
  return SLOTS.map((value) => ({ value, label: value }));
}

/**
 * The end time's list: the 15-minute times after the start, each with how
 * long the event would then last. On the start's own day only those after
 * the start; on a later end date every time of the day.
 */
export function endTimeOptions(draft: Pick<EventDraft, "startDate" | "startTime" | "endDate">): TimeOption[] {
  const start = dateTimeOf(draft.startDate, draft.startTime);
  if (!start) return startTimeOptions();
  const options: TimeOption[] = [];
  for (const value of SLOTS) {
    const end = dateTimeOf(draft.endDate, value);
    if (!end) return startTimeOptions();
    const minutes = minutesBetween(start, end);
    if (minutes > 0) options.push({ value, label: `${value} (${durationLabel(minutes)})` });
  }
  return options;
}

// --- Defaults -------------------------------------------------------------------------------

/**
 * A new event's default span: the next full hour in `timeZone`, for an
 * hour. At 14:20 that is 15:00 to 16:00; at 14:00 sharp, 15:00 too; after
 * 23:00 it is midnight, the next day.
 */
export function defaultSpan(
  timeZone: string,
  now: Temporal.Instant = Temporal.Now.instant(),
): { start: Temporal.PlainDateTime; end: Temporal.PlainDateTime } {
  const wall = now.toZonedDateTimeISO(timeZone).toPlainDateTime();
  const start = wall.round({ smallestUnit: "hour", roundingMode: "floor" }).add({ hours: 1 });
  return { start, end: start.add({ hours: 1 }) };
}

/** The date a wire value falls on in `timeZone` (a date as it is, an instant converted), or `null` when it is neither. */
function dayOfWire(value: string | undefined, timeZone: string): Temporal.PlainDate | null {
  if (value === undefined) return null;
  if (isDateKey(value)) return parseDateKey(value);
  try {
    return zonedOf(value, timeZone).toPlainDate();
  } catch {
    return null;
  }
}

/** The wall-clock moment of a wire value in `timeZone`; a bare date takes `time`. `null` when it is neither. */
function momentOfWire(value: string | undefined, timeZone: string, time: Temporal.PlainTime): Temporal.PlainDateTime | null {
  if (value === undefined) return null;
  if (isDateKey(value)) return parseDateKey(value)?.toPlainDateTime(time) ?? null;
  try {
    return zonedOf(value, timeZone).toPlainDateTime();
  } catch {
    return null;
  }
}

/** The start and end fields of a new event, from what opened the form (`CreateInit`), else the default span. */
export function draftOfSeed(seed: FormSeed, timeZone: string, now: Temporal.Instant = Temporal.Now.instant()): EventDraft {
  const fallback = defaultSpan(timeZone, now);
  let span: Pick<EventDraft, "startDate" | "startTime" | "endDate" | "endTime">;

  if (seed.allDay) {
    const first = dayOfWire(seed.start, timeZone) ?? todayIn(timeZone, now);
    const after = dayOfWire(seed.end, timeZone);
    // The wire's end is the day after the last day.
    let last = after ? after.subtract({ days: 1 }) : first;
    if (Temporal.PlainDate.compare(last, first) < 0) last = first;
    // The times are what turning All day off will show.
    span = { startDate: first.toString(), startTime: formatTime(fallback.start), endDate: last.toString(), endTime: formatTime(fallback.end) };
  } else {
    const start = momentOfWire(seed.start, timeZone, fallback.start.toPlainTime()) ?? fallback.start;
    let end = momentOfWire(seed.end, timeZone, fallback.start.toPlainTime()) ?? start.add({ hours: 1 });
    if (Temporal.PlainDateTime.compare(end, start) <= 0) end = start.add({ hours: 1 });
    span = {
      startDate: start.toPlainDate().toString(),
      startTime: formatTime(start),
      endDate: end.toPlainDate().toString(),
      endTime: formatTime(end),
    };
  }

  return {
    title: seed.title ?? "",
    calendarId: seed.calendarId ?? null,
    allDay: seed.allDay === true,
    ...span,
    repeat: repeatDraftOf(null, span.startDate),
    repeatTouched: false,
    origin: null,
    location: "",
    notes: "",
  };
}

/** The form for an existing occurrence: its times in `timeZone`, its repeat, and the date that repeat is anchored to. */
export function draftOfOccurrence(occurrence: Occurrence, timeZone: string, now: Temporal.Instant = Temporal.Now.instant()): EventDraft {
  const fallback = defaultSpan(timeZone, now);
  let span: Pick<EventDraft, "startDate" | "startTime" | "endDate" | "endTime">;
  if (occurrence.allDay) {
    const first = parseDateKey(occurrence.start) ?? todayIn(timeZone, now);
    let last = (parseDateKey(occurrence.end) ?? first.add({ days: 1 })).subtract({ days: 1 });
    if (Temporal.PlainDate.compare(last, first) < 0) last = first;
    span = {
      startDate: first.toString(),
      startTime: formatTime(fallback.start),
      endDate: last.toString(),
      endTime: formatTime(fallback.end),
    };
  } else {
    const start = zonedOf(occurrence.start, timeZone);
    const end = zonedOf(occurrence.end, timeZone);
    span = {
      startDate: start.toPlainDate().toString(),
      startTime: formatTime(start),
      endDate: end.toPlainDate().toString(),
      endTime: formatTime(end),
    };
  }
  const anchor = seriesStartDate(occurrence.originalStart ?? occurrence.start, timeZone);
  return {
    title: occurrence.title,
    calendarId: occurrence.calendarId,
    allDay: occurrence.allDay,
    ...span,
    repeat: repeatDraftOf(occurrence.repeat, anchor),
    repeatTouched: false,
    origin: { repeat: occurrence.repeat, anchor },
    location: occurrence.location,
    notes: occurrence.notes,
  };
}

// --- Editing the times ---------------------------------------------------------------------------

/**
 * Change the start's date or time. The end moves with it, so the event keeps
 * its length (all-day: its number of days). An end that was already before
 * the start (an error being fixed) stays where it is.
 */
export function withStart(draft: EventDraft, change: Partial<Pick<EventDraft, "startDate" | "startTime">>): EventDraft {
  const next = { ...draft, ...change };
  const before = startOf(draft);
  const after = startOf(next);
  const end = endOf(draft);
  if (!before || !after || !end) return next;
  const length = minutesBetween(before, end);
  if (length < 0 || (length === 0 && !draft.allDay)) return next;
  const moved = end.add({ minutes: minutesBetween(before, after) });
  return draft.allDay
    ? { ...next, endDate: moved.toPlainDate().toString() }
    : { ...next, endDate: moved.toPlainDate().toString(), endTime: formatTime(moved) };
}

export function withEnd(draft: EventDraft, change: Partial<Pick<EventDraft, "endDate" | "endTime">>): EventDraft {
  return { ...draft, ...change };
}

/**
 * The All day checkbox. Turning it on keeps the dates (an end at midnight
 * is the day before: 22:00 to 00:00 is one day); turning it off gives the
 * event its times back, an hour long if they would end before they start.
 */
export function withAllDay(draft: EventDraft, allDay: boolean): EventDraft {
  if (allDay === draft.allDay) return draft;
  if (allDay) {
    const start = parseDateKey(draft.startDate);
    const end = parseDateKey(draft.endDate);
    if (!start || !end) return { ...draft, allDay };
    const endsAtMidnight = draft.endTime === "00:00" && Temporal.PlainDate.compare(end, start) > 0;
    return { ...draft, allDay, endDate: (endsAtMidnight ? end.subtract({ days: 1 }) : end).toString() };
  }
  const start = dateTimeOf(draft.startDate, draft.startTime);
  const end = dateTimeOf(draft.endDate, draft.endTime);
  if (!start || !end || Temporal.PlainDateTime.compare(end, start) > 0) return { ...draft, allDay };
  const longer = start.add({ hours: 1 });
  return { ...draft, allDay, endDate: longer.toPlainDate().toString(), endTime: formatTime(longer) };
}

// --- What is wrong ---------------------------------------------------------------------------------

export interface DraftProblems {
  start?: string;
  end?: string;
  repeat?: string;
}

/** What is wrong with the draft, field by field; empty when it can be saved. */
export function problemsOf(draft: EventDraft): DraftProblems {
  const problems: DraftProblems = {};
  const start = startOf(draft);
  const end = endOf(draft);
  if (!start) problems.start = "Enter a start date.";
  if (!end) problems.end = "Enter an end date.";
  else if (start) {
    if (draft.allDay) {
      if (Temporal.PlainDateTime.compare(end, start) < 0) problems.end = "The end date can't be before the start date.";
    } else if (Temporal.PlainDateTime.compare(end, start) <= 0) {
      problems.end = "The end must be after the start.";
    }
  }
  // An untouched repeat is the occurrence's own: leave it be, whatever the start has moved to.
  if (draft.repeat.preset !== "none" && (draft.repeatTouched || draft.origin === null)) {
    if (draft.repeat.end === "until") {
      const until = parseDateKey(draft.repeat.until);
      const first = parseDateKey(draft.startDate);
      if (!until) problems.repeat = "Enter the date the repeat ends.";
      else if (first && Temporal.PlainDate.compare(until, first) < 0) problems.repeat = "The repeat can't end before it starts.";
    } else if (draft.repeat.end === "count") {
      const count = Number(draft.repeat.count);
      if (!Number.isInteger(count) || count < 1 || count > REPEAT_COUNT_MAX) {
        problems.repeat = `Use a number of occurrences from 1 to ${REPEAT_COUNT_MAX}.`;
      }
    }
  }
  return problems;
}

export function hasProblems(problems: DraftProblems): boolean {
  return problems.start !== undefined || problems.end !== undefined || problems.repeat !== undefined;
}

// --- Repeats ----------------------------------------------------------------------------------------------

function weekdayAt(date: string): Weekday {
  const day = parseDateKey(date);
  return day ? (WEEKDAYS[day.dayOfWeek - 1] ?? "MO") : "MO";
}

function inWeekOrder(days: readonly Weekday[]): Weekday[] {
  return WEEKDAYS.filter((day) => days.includes(day));
}

/** Where "On" starts: a month on for most, a year for monthly, five for annual. */
function defaultUntil(preset: RepeatPreset, startDate: string): string {
  const start = parseDateKey(startDate);
  if (!start) return "";
  const later = preset === "yearly" ? start.add({ years: 5 }) : preset === "monthly" ? start.add({ years: 1 }) : start.add({ months: 1 });
  return later.toString();
}

const DEFAULT_COUNT = "10";

/** The picker's state for a repeat; `anchor` is the date its weekdays and days of the month follow. */
export function repeatDraftOf(repeat: Repeat | null, anchor: string): RepeatDraft {
  const own = weekdayAt(anchor);
  const base: RepeatDraft = { preset: "none", days: [own], end: "never", until: defaultUntil("daily", anchor), count: DEFAULT_COUNT };
  if (!repeat) return base;
  const draft: RepeatDraft = { ...base, preset: repeat.freq === "weekly" ? "weekly" : repeat.freq };
  if (repeat.freq === "weekly") {
    const days = inWeekOrder(repeat.byDay !== undefined && repeat.byDay.length > 0 ? repeat.byDay : [own]);
    draft.days = days;
    draft.preset = days.length === 1 && days[0] === own ? "weekly" : "custom";
  }
  draft.until = defaultUntil(draft.preset, anchor);
  if (repeat.end.type === "until") {
    draft.end = "until";
    draft.until = repeat.end.date;
  } else if (repeat.end.type === "count") {
    draft.end = "count";
    draft.count = String(repeat.end.count);
  }
  return draft;
}

/** The repeat the draft means for an event starting on `startDate`, or `null` for "Does not repeat". */
export function repeatOf(draft: Pick<EventDraft, "repeat" | "startDate">): Repeat | null {
  const { repeat } = draft;
  const end: Repeat["end"] =
    repeat.end === "until" ? { type: "until", date: repeat.until } : repeat.end === "count" ? { type: "count", count: Number(repeat.count) } : { type: "never" };
  switch (repeat.preset) {
    case "none":
      return null;
    case "weekly":
      // Follows the start date: the label does too.
      return { freq: "weekly", byDay: [weekdayAt(draft.startDate)], end };
    case "custom":
      return { freq: "weekly", byDay: inWeekOrder(repeat.days), end };
    default:
      return { freq: repeat.preset, end };
  }
}

/**
 * The repeat as it stands: the one the occurrence had until the user touches
 * the picker, then what the picker says.
 */
export function currentRepeat(draft: EventDraft): Repeat | null {
  return !draft.repeatTouched && draft.origin ? draft.origin.repeat : repeatOf(draft);
}

/** The date the picker's labels follow ("Weekly on Friday"): the start's, but an untouched repeat keeps its own anchor. */
export function repeatLabelDate(draft: EventDraft): string {
  return !draft.repeatTouched && draft.origin ? draft.origin.anchor : draft.startDate;
}

export interface RepeatOption {
  value: RepeatPreset;
  label: string;
}

/**
 * The picker's choices, worded for a start date: "Weekly on Friday",
 * "Monthly on day 16", "Annually on 16 October". Without a valid date the
 * day-specific ones lose their day.
 */
export function repeatOptions(startDate: string, timeZone: string): RepeatOption[] {
  const known = parseDateKey(startDate) !== null;
  const label = (freq: RepeatFreq, plain: string): string =>
    known ? describeRepeat({ freq, end: { type: "never" } }, startDate, timeZone) : plain;
  return [
    { value: "none", label: "Does not repeat" },
    { value: "daily", label: label("daily", "Daily") },
    { value: "weekly", label: label("weekly", "Weekly") },
    { value: "weekdays", label: label("weekdays", "Every weekday (Monday to Friday)") },
    { value: "monthly", label: label("monthly", "Monthly") },
    { value: "yearly", label: label("yearly", "Annually") },
    { value: "custom", label: "Custom days…" },
  ];
}

/** "Weekly on Monday, Wednesday, until 1 Dec 2026", for under the picker; `null` when it does not repeat. */
export function repeatSummary(draft: EventDraft, timeZone: string): string | null {
  const repeat = currentRepeat(draft);
  if (!repeat) return null;
  const date = repeatLabelDate(draft);
  if (parseDateKey(date) === null) return null;
  return describeRepeat(repeat, date, timeZone);
}

/** The picker after choosing a preset. "Custom days…" starts from what the last choice meant. */
export function choosePreset(repeat: RepeatDraft, preset: RepeatPreset, startDate: string): RepeatDraft {
  if (preset === repeat.preset) return repeat;
  const next: RepeatDraft = { ...repeat, preset };
  if (preset === "custom") {
    next.days = repeat.preset === "weekdays" ? ["MO", "TU", "WE", "TH", "FR"] : [weekdayAt(startDate)];
  }
  if (repeat.end === "until" && preset !== "none" && parseDateKey(repeat.until) === null) next.until = defaultUntil(preset, startDate);
  return next;
}

/** Add or drop a day of "Custom days…"; the last one can't be dropped. */
export function toggleDay(repeat: RepeatDraft, day: Weekday): RepeatDraft {
  const has = repeat.days.includes(day);
  if (has && repeat.days.length === 1) return repeat;
  return { ...repeat, days: inWeekOrder(has ? repeat.days.filter((each) => each !== day) : [...repeat.days, day]) };
}

/** The picker after choosing how the repeat ends; "On" needs a date on or after the start. */
export function chooseEnd(repeat: RepeatDraft, end: RepeatEndKind, startDate: string): RepeatDraft {
  const next: RepeatDraft = { ...repeat, end };
  if (end === "until") {
    const until = parseDateKey(repeat.until);
    const first = parseDateKey(startDate);
    if (!until || (first && Temporal.PlainDate.compare(until, first) < 0)) next.until = defaultUntil(repeat.preset, startDate);
  }
  return next;
}

function normalized(repeat: Repeat | null, anchor: string): unknown {
  if (!repeat) return null;
  const days =
    repeat.freq === "weekly" ? inWeekOrder(repeat.byDay !== undefined && repeat.byDay.length > 0 ? repeat.byDay : [weekdayAt(anchor)]) : null;
  const end = repeat.end.type === "until" ? ["until", repeat.end.date] : repeat.end.type === "count" ? ["count", repeat.end.count] : ["never"];
  return [repeat.freq, days, end];
}

/** Whether two repeats are the same rule (a weekly one with no days is on the anchor's weekday). Sending the same one again is no change. */
export function sameRepeat(a: Repeat | null, b: Repeat | null, anchor: string): boolean {
  return JSON.stringify(normalized(a, anchor)) === JSON.stringify(normalized(b, anchor));
}

// --- What is sent ---------------------------------------------------------------------------------------------

export interface WireTimes {
  start: string;
  end: string;
  allDay: boolean;
}

/**
 * The draft's times as the API takes them: instants for a timed event (the
 * wall clock in `timeZone`; a time that doesn't exist that day moves on), the
 * dates for an all-day one with the end the day after the last. `null` when
 * a date or time is not valid.
 */
export function wireTimesOf(draft: EventDraft, timeZone: string): WireTimes | null {
  const start = startOf(draft);
  const end = endOf(draft);
  if (!start || !end) return null;
  if (draft.allDay) {
    return { start: start.toPlainDate().toString(), end: end.toPlainDate().add({ days: 1 }).toString(), allDay: true };
  }
  const instant = (moment: Temporal.PlainDateTime) => wireInstant(moment.toZonedDateTime(timeZone, { disambiguation: "compatible" }).toInstant());
  return { start: instant(start), end: instant(end), allDay: false };
}

/** The title as saved: an empty one is "(No title)", as Google does. */
export function titleOf(draft: Pick<EventDraft, "title">): string {
  return displayTitle(draft.title).trim();
}

/** The body of `POST /api/events` for the draft, or `null` while something is wrong with it. */
export function eventInputOf(draft: EventDraft, calendarId: number, timeZone: string): EventInputBody | null {
  if (hasProblems(problemsOf(draft))) return null;
  const times = wireTimesOf(draft, timeZone);
  if (!times) return null;
  return {
    calendarId,
    title: titleOf(draft),
    location: draft.location.trim(),
    notes: draft.notes.trim(),
    allDay: times.allDay,
    start: times.start,
    end: times.end,
    repeat: currentRepeat(draft),
  };
}

/**
 * The fields of an edit that differ from the occurrence, for `changes`.
 * Start and end go together when either differs (as a drag sends them).
 * The repeat counts as changed only when the user used the picker and it now
 * means another rule; re-sending the same one is no change. `null` while
 * something is wrong with the draft.
 */
export function changedFields(draft: EventDraft, occurrence: Occurrence, timeZone: string): EventPatchBody["changes"] | null {
  const input = eventInputOf(draft, draft.calendarId ?? occurrence.calendarId, timeZone);
  if (!input) return null;
  const changes: EventPatchBody["changes"] = {};
  if (input.calendarId !== occurrence.calendarId) changes.calendarId = input.calendarId;
  if (input.title !== occurrence.title) changes.title = input.title;
  if (input.location !== occurrence.location) changes.location = input.location;
  if (input.notes !== occurrence.notes) changes.notes = input.notes;
  if (input.allDay !== occurrence.allDay) changes.allDay = input.allDay;
  // Judged on the fields, not on the instants: an hour that happens twice
  // (clocks going back) would otherwise come out as a move nobody made.
  const before = draftOfOccurrence(occurrence, timeZone);
  const moved =
    draft.allDay !== before.allDay ||
    draft.startDate !== before.startDate ||
    draft.endDate !== before.endDate ||
    (!draft.allDay && (draft.startTime !== before.startTime || draft.endTime !== before.endTime));
  if (moved) {
    changes.start = input.start;
    changes.end = input.end;
  }
  if (draft.repeatTouched) {
    const anchor = draft.origin?.anchor ?? draft.startDate;
    if (!sameRepeat(repeatOf(draft), occurrence.repeat, anchor)) changes.repeat = repeatOf(draft);
  }
  return changes;
}

/** Whether `changes` change the repeat rule. */
export function changesRepeat(changes: EventPatchBody["changes"]): boolean {
  return "repeat" in changes;
}

/**
 * The scope question for an edit of a series: a change to the repeat rule
 * can't apply to "this event" alone, so only the two broader scopes are offered.
 */
export function scopeQuestion(changes: EventPatchBody["changes"]): AskScopeOptions {
  return { action: "edit", allowThis: !changesRepeat(changes) };
}

// --- Calendars -------------------------------------------------------------------------------------------------

const LAST_CALENDAR_KEY = "almanac.lastCalendar";

/** The calendar the last saved event went to, from this browser; `null` when there is none or storage is off. */
export function readLastCalendar(): number | null {
  try {
    const stored = globalThis.localStorage?.getItem(LAST_CALENDAR_KEY);
    const id = stored ? Number(stored) : Number.NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function rememberCalendar(id: number): void {
  try {
    globalThis.localStorage?.setItem(LAST_CALENDAR_KEY, String(id));
  } catch {
    // Private windows and blocked storage: the next event simply starts from the first calendar.
  }
}

/** The calendar a new event goes to: the last one used if it still exists, else the first visible one, else the first. */
export function pickCalendar(calendars: readonly Pick<Calendar, "id" | "visible">[], lastUsed: number | null): number | null {
  const last = calendars.find((calendar) => calendar.id === lastUsed);
  return (last ?? calendars.find((calendar) => calendar.visible) ?? calendars[0])?.id ?? null;
}

// --- Errors from the server -------------------------------------------------------------------------------------

export type ErrorPlace = "when" | "repeat" | "general";

/** Where a server message ("end: must be after the start") shows: under the times, under the repeat, or above the buttons. */
export function errorPlace(message: string): ErrorPlace {
  const field = /^(\w+)(?:\.\w+)*: /.exec(message)?.[1];
  if (field === "start" || field === "end" || field === "allDay") return "when";
  if (field === "repeat") return "repeat";
  return "general";
}
