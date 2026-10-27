import {
  DAY_MS,
  addDays,
  eventOccurrenceId,
  formatInstant,
  parseInstant,
  rruleToRepeat,
  seriesOccurrenceId,
  type Occurrence,
  type Repeat,
} from "@almanac/shared";
import { RRuleTemporal } from "rrule-temporal";
import { Temporal } from "temporal-polyfill";
import type { EventContent, EventRange, EventRecord } from "../store/events.js";

/**
 * Expanding a series into its occurrences (corpus/wiki/recurrence.md), with
 * rrule-temporal on `temporal-polyfill` (Node 24 has no global Temporal).
 *
 * A timed series expands as `ZonedDateTime`s in its `tzid`, so a 10:00 weekly
 * meeting stays 10:00 local across a change of summer time, and each
 * occurrence lasts what the series lasts on the wall clock (a 23:00-08:00
 * night stays 23:00-08:00 on the night the clocks change). An all-day series
 * expands by date: its dates are put at midnight UTC for the rule and read
 * back as dates.
 *
 * An occurrence is named by its key, its original start (`time.ts`). The
 * series row's own start is always its first occurrence: the event writes
 * move it there (`snapToFirst`).
 */

/** The most occurrences one series contributes to one request: a guard against a rule that runs away. */
export const MAX_OCCURRENCES_PER_SERIES = 1000;

/** What a series' occurrences follow from: its first occurrence's times, its zone and its rule. */
export interface SeriesTiming {
  allDay: boolean;
  start: string;
  end: string;
  tzid: string;
  rrule: string;
}

/** A stored series: a row with `rrule` set. */
export type SeriesRecord = EventRecord & { rrule: string };

export function isSeries(event: EventRecord): event is SeriesRecord {
  return event.rrule !== null;
}

type Zoned = Temporal.ZonedDateTime;
type Rule = RRuleTemporal<Zoned>;

/** The `ZonedDateTime` the rule works with for a key or a start: in the series' zone, or midnight UTC for a date. */
export function keyToZoned(key: string, timing: Pick<SeriesTiming, "allDay" | "tzid">): Zoned {
  return timing.allDay
    ? Temporal.PlainDate.from(key).toZonedDateTime("UTC")
    : Temporal.Instant.fromEpochMilliseconds(parseInstant(key)).toZonedDateTimeISO(timing.tzid);
}

/** The key of an occurrence the rule generated. */
export function zonedToKey(at: Zoned, allDay: boolean): string {
  return allDay ? at.toPlainDate().toString() : formatInstant(at.epochMilliseconds);
}

// Building a rule parses it; a request asks the same series many questions.
const rules = new Map<string, Rule>();

/** The series' rule, starting at its start. Cached by what it depends on (a few hundred at most). */
export function ruleOf(timing: SeriesTiming): Rule {
  const id = `${timing.allDay ? "date" : timing.tzid}|${timing.start}|${timing.rrule}`;
  let rule = rules.get(id);
  if (rule === undefined) {
    rule = new RRuleTemporal({ temporal: Temporal, rruleString: timing.rrule, dtstart: keyToZoned(timing.start, timing) });
    if (rules.size >= 500) rules.clear();
    rules.set(id, rule);
  }
  return rule;
}

/** The days an all-day series lasts. */
function dayCount(timing: Pick<SeriesTiming, "start" | "end">): number {
  return Temporal.PlainDate.from(timing.start).until(Temporal.PlainDate.from(timing.end)).days;
}

/** How long a timed series lasts on the wall clock in its zone. */
function wallDuration(timing: Pick<SeriesTiming, "start" | "end" | "tzid">): Temporal.Duration {
  const start = keyToZoned(timing.start, { allDay: false, tzid: timing.tzid }).toPlainDateTime();
  const end = keyToZoned(timing.end, { allDay: false, tzid: timing.tzid }).toPlainDateTime();
  return start.until(end, { largestUnit: "days" });
}

/**
 * The end of the occurrence that starts at `key`: the series' length added on
 * the wall clock. Where that lands on or before the start (a clock change
 * inside a short event), the series' length in real time instead.
 */
export function occurrenceEnd(timing: SeriesTiming, key: string): string {
  if (timing.allDay) return addDays(key, dayCount(timing));
  const start = keyToZoned(key, timing);
  const end = start.toPlainDateTime().add(wallDuration(timing)).toZonedDateTime(timing.tzid);
  const exact = parseInstant(timing.end) - parseInstant(timing.start);
  return formatInstant(end.epochMilliseconds > start.epochMilliseconds ? end.epochMilliseconds : start.epochMilliseconds + exact);
}

/** Whether the rule generates an occurrence at `key` (excluded dates aside). */
export function isGenerated(timing: SeriesTiming, key: string): boolean {
  return ruleOf(timing).matches(keyToZoned(key, timing));
}

/**
 * The first key at or after `from` (a key or a start) that the rule
 * generates and `excluded` does not hold, or `undefined` when the rule has
 * no more.
 */
export function nextKey(timing: SeriesTiming, from: string, excluded: ReadonlySet<string> = new Set()): string | undefined {
  const rule = ruleOf(timing);
  let at = rule.next(keyToZoned(from, timing), true);
  // Each excluded key is skipped at most once.
  for (let skipped = 0; at !== null && skipped <= excluded.size; skipped++) {
    const key = zonedToKey(at, timing.allDay);
    if (!excluded.has(key)) return key;
    at = rule.next(at, false);
  }
  return undefined;
}

/** The last key before `before` that the rule generates and `excluded` does not hold. */
export function previousKey(timing: SeriesTiming, before: string, excluded: ReadonlySet<string> = new Set()): string | undefined {
  const rule = ruleOf(timing);
  let at = rule.previous(keyToZoned(before, timing), false);
  for (let skipped = 0; at !== null && skipped <= excluded.size; skipped++) {
    const key = zonedToKey(at, timing.allDay);
    if (!excluded.has(key)) return key;
    at = rule.previous(at, false);
  }
  return undefined;
}

/** How many occurrences the rule generates before `key`, excluded dates included (they still count towards `COUNT`). */
export function countBefore(timing: SeriesTiming, key: string): number {
  const rule = ruleOf(timing);
  const before = keyToZoned(key, timing);
  let count = 0;
  rule.all((at) => {
    if (Temporal.ZonedDateTime.compare(at, before) >= 0) return false;
    count++;
    return true;
  });
  return count;
}

/**
 * `timing` with its start moved to the rule's first occurrence at or after it
 * (keeping its length), for a weekly repeat whose days leave out the start's
 * weekday, or every weekday from a Saturday. `undefined` when the rule has no
 * occurrence at all (it ends before its first day).
 */
export function snapToFirst<T extends SeriesTiming>(timing: T): T | undefined {
  const first = nextKey(timing, timing.start);
  if (first === undefined) return undefined;
  if (first === timing.start) return timing;
  return { ...timing, start: first, end: occurrenceEnd(timing, first) };
}

/** The series' repeat, as the occurrences carry it. */
export function seriesRepeat(series: SeriesRecord): Repeat {
  return rruleToRepeat(series.rrule, series.start, series.tzid);
}

/**
 * A stored row as the occurrence the views show: `e<id>`, for a one-off event
 * (`repeat` null) or an exception of a series (its `seriesId` and
 * `originalStart`, and the series' `repeat`).
 */
export function rowOccurrence(event: EventRecord, repeat: Repeat | null): Occurrence {
  return {
    id: eventOccurrenceId(event.id),
    eventId: event.id,
    seriesId: event.seriesId,
    originalStart: event.originalStart,
    calendarId: event.calendarId,
    title: event.title,
    location: event.location,
    notes: event.notes,
    allDay: event.allDay,
    start: event.start,
    end: event.end,
    repeat,
    reminderMinutes: event.reminderMinutes,
  };
}

/** The occurrence the series generates at `key`: `s<id>:<key>`, the series' content at that time. */
export function seriesOccurrence(series: SeriesRecord, key: string, repeat: Repeat = seriesRepeat(series)): Occurrence {
  return {
    id: seriesOccurrenceId(series.id, key),
    eventId: series.id,
    seriesId: series.id,
    originalStart: key,
    calendarId: series.calendarId,
    title: series.title,
    location: series.location,
    notes: series.notes,
    allDay: series.allDay,
    start: key,
    end: occurrenceEnd(series, key),
    repeat,
    reminderMinutes: series.reminderMinutes,
  };
}

/** The keys a series does not generate an occurrence for: its excluded dates, and those its exceptions replace. */
export function excludedKeys(series: SeriesRecord, exceptions: readonly Pick<EventRecord, "originalStart">[]): Set<string> {
  const keys = new Set(series.exdates);
  for (const exception of exceptions) if (exception.originalStart !== null) keys.add(exception.originalStart);
  return keys;
}

/** Epoch ms of midnight UTC on a date, the rule's time for an all-day occurrence. */
function utcMidnight(date: string): number {
  return Temporal.PlainDate.from(date).toZonedDateTime("UTC").epochMilliseconds;
}

/**
 * The occurrences the series generates that overlap the range: a timed one
 * when it starts before `range.to` and ends after `range.from` (so one that
 * started earlier and is still going is in), an all-day one when its dates
 * overlap `range.dates` (the range's dates in the user's display time zone),
 * as `EventStore.listInRange` matches stored rows. By start, at most
 * `MAX_OCCURRENCES_PER_SERIES`.
 *
 * Excluded dates are left out, and so is every key in `exceptions` (all of
 * the series' exceptions, wherever they are now): an exception is a stored
 * row, which `listInRange` finds at the time it was moved to, in this range
 * or another. `GET /api/occurrences` puts the two together.
 */
export function expandSeries(series: SeriesRecord, exceptions: readonly EventRecord[], range: EventRange): Occurrence[] {
  const excluded = excludedKeys(series, exceptions);
  const repeat = seriesRepeat(series);
  const rule = ruleOf(series);
  const found: Occurrence[] = [];

  if (series.allDay) {
    const days = dayCount(series);
    const starts = rule.between(new Date(utcMidnight(addDays(range.dates.start, -days))), new Date(utcMidnight(range.dates.end)), true);
    for (const at of starts) {
      const key = zonedToKey(at, true);
      if (key >= range.dates.end || addDays(key, days) <= range.dates.start || excluded.has(key)) continue;
      found.push(seriesOccurrence(series, key, repeat));
      if (found.length >= MAX_OCCURRENCES_PER_SERIES) break;
    }
    return found;
  }

  // A day's slack on top of the length: the wall-clock length can be an hour longer than the real one.
  const reach = parseInstant(series.end) - parseInstant(series.start) + DAY_MS;
  for (const at of rule.between(new Date(range.from - reach), new Date(range.to), true)) {
    if (at.epochMilliseconds >= range.to) continue;
    const key = zonedToKey(at, false);
    if (excluded.has(key)) continue;
    const occurrence = seriesOccurrence(series, key, repeat);
    if (parseInstant(occurrence.end) <= range.from) continue;
    found.push(occurrence);
    if (found.length >= MAX_OCCURRENCES_PER_SERIES) break;
  }
  return found;
}

/**
 * The occurrence a search shows for a series: the first one that has not
 * ended at `now`, or the last one when the series is over. Excluded dates and
 * exceptions are skipped (an exception that matches shows as itself).
 * `today` is the date `now` falls on in the user's display time zone, which
 * all-day occurrences are measured against. `undefined` when the series has
 * no occurrence left that is its own.
 */
export function searchOccurrence(
  series: SeriesRecord,
  exceptions: readonly EventRecord[],
  now: number,
  today: string,
): Occurrence | undefined {
  const excluded = excludedKeys(series, exceptions);
  const repeat = seriesRepeat(series);
  if (series.allDay) {
    // The first that ends after today starts after today minus its length.
    const next = nextKey(series, addDays(today, 1 - dayCount(series)), excluded);
    const key = next ?? previousKey(series, addDays(today, 1 - dayCount(series)), excluded);
    return key === undefined ? undefined : seriesOccurrence(series, key, repeat);
  }
  // Looking from its length (and a day) before now catches one still going.
  const rule = ruleOf(series);
  const reach = parseInstant(series.end) - parseInstant(series.start) + DAY_MS;
  let at = rule.next(new Date(now - reach), true);
  // Only the excluded ones and the couple that ended within reach are passed over.
  for (let passed = 0; at !== null && passed <= excluded.size + 3; passed++) {
    const key = zonedToKey(at, false);
    if (!excluded.has(key) && parseInstant(occurrenceEnd(series, key)) > now) return seriesOccurrence(series, key, repeat);
    at = rule.next(at, false);
  }
  // Either the series is over (`at` is null) or, past the guard, the next start after now.
  const key = at === null ? previousKey(series, formatInstant(now), excluded) : nextKey(series, formatInstant(now), excluded);
  return key === undefined ? undefined : seriesOccurrence(series, key, repeat);
}

/** The content fields of an occurrence or a row, for comparing and copying. */
export function contentOf(event: EventContent): EventContent {
  const { calendarId, title, location, notes, allDay, start, end, reminderMinutes } = event;
  return { calendarId, title, location, notes, allDay, start, end, reminderMinutes };
}
