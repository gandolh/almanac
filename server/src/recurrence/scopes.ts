import {
  WEEKDAYS,
  addDays,
  eventInputSchema,
  formatInstant,
  isDateKey,
  parseInstant,
  repeatToRRule,
  startDate,
  type EditScope,
  type EventChanges,
  type EventDeleteQuery,
  type EventInput,
  type EventPatch,
  type Occurrence,
  type Repeat,
} from "@almanac/shared";
import { Temporal } from "temporal-polyfill";
import type { Db } from "../db/open.js";
import { ApiError } from "../errors.js";
import type { CalendarStore } from "../store/calendars.js";
import type { EventContent, EventRecord, EventStore } from "../store/events.js";
import {
  contentOf,
  countBefore,
  isGenerated,
  isSeries,
  nextKey,
  occurrenceEnd,
  previousKey,
  rowOccurrence,
  seriesOccurrence,
  seriesRepeat,
  snapToFirst,
  type SeriesRecord,
  type SeriesTiming,
} from "./expand.js";

/**
 * The event writes, and what each edit scope does to the stored rows
 * (corpus/wiki/recurrence.md). Each call is one transaction. The store runs
 * the SQL; this module decides which rows change.
 *
 * Every edit is aimed at one occurrence: the one the user opened or dragged.
 * `changes` are what it becomes, so a drag sends that occurrence's new
 * `start` and `end`, not the series' first ones. A field counts as changed
 * when it differs from what that occurrence shows.
 *
 * - **this**: a generated occurrence gets an exception row with the changes
 *   (`original_start` = its key); an exception is updated. Deleting adds the
 *   key to the excluded dates and removes the exception. A changed `repeat`
 *   is refused (400).
 * - **following**: the old series ends before this occurrence (`UNTIL` the
 *   day before, or `COUNT` cut to the occurrences before it), and a new series
 *   starts at this occurrence's slot, moved as far as the edit moved the
 *   occurrence from where it is now (as for **all**), with the changes and the
 *   rest of the old end. A new repeat follows this occurrence's date.
 *   Exceptions and excluded dates from this occurrence on move to the new
 *   series, re-keyed by as far as the edit moved this occurrence, and are
 *   dropped when the new rule does not generate their new key. A moved
 *   exception takes the changed fields it still had the old value of, and
 *   one still at its slot's times moves with the series. On the first
 *   occurrence (none before it that is not deleted) it is **all**. Deleting
 *   ends the old series there and drops what came after.
 * - **all**: the series row changes. When the times or the repeat change,
 *   every occurrence moves by as far as the edit moved this one from where
 *   it is now (a drag shifts every occurrence by the same wall-clock offset,
 *   a weekly repeat's days with it; an exception moved to another day whose
 *   end alone changes moves nothing), and its exceptions and excluded dates
 *   are dropped. A new repeat follows this occurrence's date (monthly on its
 *   day of the month). Changes to the title, location, notes or calendar keep the
 *   exceptions, and reach each exception that still had the series' old
 *   value (the edited occurrence takes them anyway). Deleting removes the
 *   series and its exceptions.
 *
 * One-off events ignore `scope` and `occurrence`; a one-off given a `repeat`
 * becomes a series in the user's display time zone (its `tzid` changes to
 * it), and `repeat: null` on a series ("all" or "following") leaves this
 * occurrence as a one-off event.
 *
 * A series' start is always its first occurrence: when a repeat leaves out
 * the start's day (weekly on Monday from a Friday), the start moves forward
 * to the first day it does repeat on, keeping its time and length.
 */

export interface ScopeContext {
  db: Db;
  events: EventStore;
}

const noSuchEvent = () => new ApiError("not_found", "There is no such event.");
const noSuchOccurrence = () => new ApiError("not_found", "That repeating event has no occurrence at that time.");

/** What a write to a series is aimed at: one of its occurrences, and the scope. */
interface Aim {
  series: SeriesRecord;
  /** The occurrence's key. */
  key: string;
  /** The exception row that replaces it, if it has one. */
  exception: EventRecord | undefined;
  /** All the series' exceptions. */
  exceptions: EventRecord[];
  scope: EditScope;
  /** What the occurrence is now: the exception's content, or the series' at `key`. */
  current: EventContent;
  repeat: Repeat;
}

type Target = { kind: "single"; event: EventRecord } | ({ kind: "series" } & Aim);

function needScope(scope: EditScope | undefined): EditScope {
  if (scope === undefined) {
    throw new ApiError("validation", "scope: is needed for a repeating event: this, following or all");
  }
  return scope;
}

/** The row `id` names, and for a series or an exception the occurrence and scope the write is aimed at. */
function aim(events: EventStore, userId: string, id: number, scope?: EditScope, occurrence?: string): Target {
  const row = events.get(userId, id);
  if (!row) throw noSuchEvent();

  let series: SeriesRecord;
  let key: string;
  if (row.seriesId !== null && row.originalStart !== null) {
    // An exception: its series, and the occurrence it replaces.
    const parent = events.get(userId, row.seriesId);
    if (!parent || !isSeries(parent)) throw noSuchEvent();
    if (occurrence !== undefined && occurrence !== row.originalStart) {
      throw new ApiError("validation", "occurrence: is not the occurrence this event replaces");
    }
    series = parent;
    key = row.originalStart;
  } else if (isSeries(row)) {
    series = row;
    const given = needScope(scope) === "all" ? (occurrence ?? row.start) : occurrence;
    if (given === undefined) {
      throw new ApiError("validation", "occurrence: is needed to change part of a repeating event");
    }
    key = given;
  } else {
    return { kind: "single", event: row };
  }

  const exceptions = events.listExceptions(userId, series.id);
  const exception = exceptions.find((candidate) => candidate.originalStart === key);
  const generated =
    isDateKey(key) === series.allDay && !series.exdates.includes(key) && isGenerated(series, key);
  if (!exception && !generated && !(occurrence === undefined && key === series.start)) throw noSuchOccurrence();
  const current = exception
    ? contentOf(exception)
    : { ...contentOf(series), start: key, end: occurrenceEnd(series, key) };
  return {
    kind: "series",
    series,
    key,
    exception,
    exceptions,
    scope: needScope(scope),
    current,
    repeat: seriesRepeat(series),
  };
}

/**
 * `current` with `changes` on top, checked as a whole: a new end alone must
 * still follow the start. Turning the event all-day or timed without a new
 * reminder drops the old one, which the other kind doesn't offer (brief 15).
 */
function apply(current: EventContent, changes: EventChanges, repeat: Repeat | null): EventInput {
  const kindChanged = changes.allDay !== undefined && changes.allDay !== current.allDay;
  const reminderMinutes = changes.reminderMinutes !== undefined ? changes.reminderMinutes : kindChanged ? null : current.reminderMinutes;
  return eventInputSchema.parse({
    ...current,
    ...changes,
    reminderMinutes,
    repeat: changes.repeat === undefined ? repeat : changes.repeat,
  });
}

/** The fields an edit carries as they are, which "all" spreads to the exceptions that still had the old value. */
const FIELDS = ["calendarId", "title", "location", "notes", "reminderMinutes"] as const;
type Fields = Partial<Pick<EventContent, (typeof FIELDS)[number]>>;

/** The title, location, notes, calendar and reminder of `next` that differ from `current`. */
function changedFields(current: EventContent, next: EventContent): Fields {
  const fields: Fields = {};
  for (const field of FIELDS) if (next[field] !== current[field]) Object.assign(fields, { [field]: next[field] });
  return fields;
}

function withTimes(next: EventContent): Pick<EventContent, "allDay" | "start" | "end"> {
  return { allDay: next.allDay, start: next.start, end: next.end };
}

function timesChanged(current: EventContent, next: EventContent): boolean {
  return current.allDay !== next.allDay || current.start !== next.start || current.end !== next.end;
}

/** Whether two repeats are the same rule from `start`. */
function sameRepeat(a: Repeat, b: Repeat, start: string, tzid: string): boolean {
  return repeatToRRule(a, start, tzid) === repeatToRRule(b, start, tzid);
}

/** A start or key on the wall clock in `tzid`: a date at midnight, an instant as the zone shows it. */
function wall(value: string, tzid: string): Temporal.PlainDateTime {
  return isDateKey(value)
    ? Temporal.PlainDate.from(value).toPlainDateTime()
    : Temporal.Instant.fromEpochMilliseconds(parseInstant(value)).toZonedDateTimeISO(tzid).toPlainDateTime();
}

/** A wall-clock reading back as a start: a date for an all-day event, the instant it is in `tzid` for a timed one. */
function unwall(at: Temporal.PlainDateTime, allDay: boolean, tzid: string): string {
  return allDay ? at.toPlainDate().toString() : formatInstant(at.toZonedDateTime(tzid).epochMilliseconds);
}

/** How far the wall clock moves from `from` to `to`. */
function wallDelta(from: string, to: string, tzid: string): Temporal.Duration {
  return wall(from, tzid).until(wall(to, tzid), { largestUnit: "days" });
}

/** `value` moved by a wall-clock offset, as a start of an all-day or a timed event. */
function shift(value: string, delta: Temporal.Duration, allDay: boolean, tzid: string): string {
  return unwall(wall(value, tzid).add(delta), allDay, tzid);
}

/** An event that starts at `start` and lasts what `like` lasts on the wall clock (in days when all-day). */
function withLength(start: string, like: EventContent, tzid: string): { start: string; end: string } {
  if (like.allDay) {
    const days = Temporal.PlainDate.from(like.start).until(Temporal.PlainDate.from(like.end)).days;
    return { start, end: addDays(start, days) };
  }
  const end = shift(start, wallDelta(like.start, like.end, tzid), false, tzid);
  // A clock change can fold a short event onto itself; then its real length.
  return parseInstant(end) > parseInstant(start)
    ? { start, end }
    : { start, end: formatInstant(parseInstant(start) + parseInstant(like.end) - parseInstant(like.start)) };
}

/**
 * A repeat's weekdays moved with a start that moved by `days`: weekly on
 * Monday dragged a day later is weekly on Tuesday, and every weekday becomes
 * weekly on Tuesday to Saturday. Other repeats follow the start by themselves.
 */
function rotate(repeat: Repeat, days: number): Repeat {
  const turn = ((days % 7) + 7) % 7;
  if (turn === 0 || (repeat.freq !== "weekly" && repeat.freq !== "weekdays")) return repeat;
  // A weekly repeat without days repeats on the start's, which has moved already.
  if (repeat.freq === "weekly" && repeat.byDay === undefined) return repeat;
  const from = repeat.freq === "weekdays" ? WEEKDAYS.slice(0, 5) : (repeat.byDay ?? []);
  const byDay = from.map((day) => WEEKDAYS[(WEEKDAYS.indexOf(day) + turn) % 7] ?? day);
  return { freq: "weekly", byDay: WEEKDAYS.filter((day) => byDay.includes(day)), end: repeat.end };
}

/** How many calendar days the wall clock moves from `from` to `to`. */
function dayShift(from: string, to: string, tzid: string): number {
  return wall(from, tzid).toPlainDate().until(wall(to, tzid).toPlainDate()).days;
}

/**
 * A series' times and rule, moved to its first occurrence. 400 when the
 * repeat ends before the start, or before it ever happens.
 */
function settle<T extends SeriesTiming>(timing: T, repeat: Repeat): T {
  if (repeat.end.type === "until" && repeat.end.date < startDate(timing.start, timing.tzid)) {
    throw new ApiError("validation", "repeat.end.date: must not be before the start");
  }
  const settled = snapToFirst(timing);
  if (!settled) throw new ApiError("validation", "repeat: ends before it first happens");
  return settled;
}

/** The series' first occurrence that is not deleted: its exception, or the one it generates. */
function firstOccurrence(events: EventStore, userId: string, seriesId: number): Occurrence {
  const series = events.get(userId, seriesId);
  if (!series || !isSeries(series)) throw new Error(`Series ${seriesId} vanished inside its own transaction.`);
  const repeat = seriesRepeat(series);
  const key = nextKey(series, series.start, new Set(series.exdates)) ?? series.start;
  const exception = events.listExceptions(userId, series.id).find((row) => row.originalStart === key);
  return exception ? rowOccurrence(exception, repeat) : seriesOccurrence(series, key, repeat);
}

/** `events.update`, for a row this transaction already found. */
function rewrite(events: EventStore, userId: string, id: number, changes: Partial<EventContent>): EventRecord {
  const row = events.update(userId, id, changes);
  if (!row) throw new Error(`Event ${id} vanished inside its own transaction.`);
  return row;
}

/** The series' rule and content for a repeat starting at `start`, moved to its first occurrence. */
function seriesTiming(content: EventContent, repeat: Repeat, anchor: string, tzid: string): EventContent & SeriesTiming {
  return settle({ ...content, tzid, rrule: repeatToRRule(repeat, anchor, tzid) }, repeat);
}

// ---------------------------------------------------------------------------
// Create

/** `POST /api/events`: a one-off event, or a series from its first occurrence. `tzid` is the user's display time zone. */
export function createEvent(ctx: ScopeContext, userId: string, input: EventInput, tzid: string): Occurrence {
  return ctx.db.transaction((): Occurrence => {
    const content = contentOf(input);
    if (input.repeat === null) return rowOccurrence(ctx.events.create(userId, { ...content, tzid }), null);
    const timing = seriesTiming(content, input.repeat, content.start, tzid);
    const series = ctx.events.create(userId, { ...contentOf(timing), tzid, rrule: timing.rrule });
    return firstOccurrence(ctx.events, userId, series.id);
  })();
}

// ---------------------------------------------------------------------------
// Update

/**
 * `PATCH /api/events/:id`. Answers the occurrence the edit leaves (see the
 * routes). `tzid` is the user's display time zone, which a one-off that
 * becomes a series takes; a series keeps its own.
 */
export function updateEvent(ctx: ScopeContext, userId: string, id: number, patch: EventPatch, tzid: string): Occurrence {
  return ctx.db.transaction((): Occurrence => {
    const target = aim(ctx.events, userId, id, patch.scope, patch.occurrence);
    if (target.kind === "single") return updateSingle(ctx.events, userId, target.event, patch.changes, tzid);
    const next = apply(target.current, patch.changes, target.repeat);
    const repeatChanged =
      patch.changes.repeat !== undefined &&
      (next.repeat === null || !sameRepeat(next.repeat, target.repeat, next.start, target.series.tzid));
    switch (target.scope) {
      case "this":
        if (repeatChanged) {
          throw new ApiError("validation", "repeat: can't change for one occurrence; choose following or all");
        }
        return updateThis(ctx.events, userId, target, next);
      case "following":
        if (isFirst(target)) return updateAll(ctx.events, userId, target, next, repeatChanged);
        return updateFollowing(ctx.events, userId, target, next, repeatChanged);
      case "all":
        return updateAll(ctx.events, userId, target, next, repeatChanged);
    }
  })();
}

/**
 * A one-off event: changed as given; a repeat makes it a series from its
 * (new) start in `tzid`, the user's display time zone now, as a new series
 * would be: the form worded the repeat in that zone ("Weekly on Thursday").
 */
function updateSingle(events: EventStore, userId: string, event: EventRecord, changes: EventChanges, tzid: string): Occurrence {
  const next = apply(contentOf(event), changes, null);
  if (next.repeat === null) return rowOccurrence(rewrite(events, userId, event.id, contentOf(next)), null);
  const timing = seriesTiming(contentOf(next), next.repeat, next.start, tzid);
  rewrite(events, userId, event.id, contentOf(timing));
  events.setRrule(userId, event.id, timing.rrule, tzid);
  return firstOccurrence(events, userId, event.id);
}

/** This occurrence only: its exception, written or updated. */
function updateThis(events: EventStore, userId: string, target: Aim, next: EventInput): Occurrence {
  if (!timesChanged(target.current, next) && Object.keys(changedFields(target.current, next)).length === 0) {
    // Nothing to write: no exception for an occurrence that is as it was.
    return target.exception
      ? rowOccurrence(target.exception, target.repeat)
      : seriesOccurrence(target.series, target.key, target.repeat);
  }
  const content = contentOf(next);
  const row = target.exception
    ? rewrite(events, userId, target.exception.id, content)
    : events.insertException(userId, target.series.id, target.key, content);
  if (!row) throw new Error(`Series ${target.series.id} vanished inside its own transaction.`);
  return rowOccurrence(row, target.repeat);
}

/** Whether no occurrence before this one is left: "this and following" is then the whole series. */
function isFirst(target: Aim): boolean {
  return previousKey(target.series, target.key, new Set(target.series.exdates)) === undefined;
}

/** The changed fields an exception takes: those where it still had the series' old value. */
function inherited(exception: EventRecord, series: SeriesRecord, fields: Fields): Fields {
  const own: Fields = {};
  for (const field of FIELDS) {
    if (fields[field] !== undefined && exception[field] === series[field]) Object.assign(own, { [field]: fields[field] });
  }
  return own;
}

/** Each exception takes the changed fields it still had the series' old value of; the edited one takes them all. */
function spreadFields(events: EventStore, userId: string, target: Aim, fields: Fields): void {
  for (const exception of target.exceptions) {
    const own = exception.id === target.exception?.id ? fields : inherited(exception, target.series, fields);
    if (Object.keys(own).length > 0) rewrite(events, userId, exception.id, own);
  }
}

/** Every occurrence. */
function updateAll(events: EventStore, userId: string, target: Aim, next: EventInput, repeatChanged: boolean): Occurrence {
  const { series, current } = target;
  const timeChanged = timesChanged(current, next);
  const fields = changedFields(current, next);

  if (next.repeat === null) {
    // No longer repeating: this occurrence, as changed, is what is left.
    for (const exception of target.exceptions) events.remove(userId, exception.id);
    events.setExdates(userId, series.id, []);
    events.setRrule(userId, series.id, null);
    return rowOccurrence(rewrite(events, userId, series.id, contentOf(next)), null);
  }

  if (!timeChanged && !repeatChanged) {
    if (Object.keys(fields).length > 0) {
      rewrite(events, userId, series.id, fields);
      spreadFields(events, userId, target, fields);
    }
    return firstOccurrence(events, userId, series.id);
  }

  // The series moves as far as the edit moved this occurrence from where it is now (nowhere, if only the repeat
  // changed). From where it is, not from its slot: an exception moved to Tuesday whose end alone changes moves nothing.
  const tzid = series.tzid;
  const from = current.start;
  const to = timeChanged ? next.start : from;
  const allDay = timeChanged ? next.allDay : series.allDay;
  const start = shift(series.start, wallDelta(from, to, tzid), allDay, tzid);
  const moved = { ...contentOf(series), ...fields, allDay, ...withLength(start, timeChanged ? next : series, tzid) };
  const repeat = repeatChanged ? next.repeat : rotate(target.repeat, dayShift(from, to, tzid));
  // A new repeat follows this occurrence's date, as the form labels it ("Monthly on day 16"); an unchanged one moves with the series.
  const timing = seriesTiming(moved, repeat, repeatChanged ? to : start, tzid);

  for (const exception of target.exceptions) events.remove(userId, exception.id);
  events.setExdates(userId, series.id, []);
  rewrite(events, userId, series.id, contentOf(timing));
  events.setRrule(userId, series.id, timing.rrule);
  return firstOccurrence(events, userId, series.id);
}

/** The old series' repeat, ending just before `key`: `COUNT` cut to the occurrences before it, or `UNTIL` the day before. */
function endBefore(series: SeriesRecord, repeat: Repeat, key: string): { repeat: Repeat; before: number } {
  if (repeat.end.type === "count") {
    const before = countBefore(series, key);
    return { repeat: { ...repeat, end: { type: "count", count: before } }, before };
  }
  return { repeat: { ...repeat, end: { type: "until", date: addDays(startDate(key, series.tzid), -1) } }, before: 0 };
}

/** Ends the old series before `key` and keeps its excluded dates before it. */
function cutSeries(events: EventStore, userId: string, target: Aim): number {
  const { series, key } = target;
  const { repeat, before } = endBefore(series, target.repeat, key);
  events.setRrule(userId, series.id, repeatToRRule(repeat, series.start, series.tzid));
  events.setExdates(userId, series.id, series.exdates.filter((date) => date < key));
  return before;
}

/** This occurrence and the ones after it: the old series ends before it, a new one starts with the changes. */
function updateFollowing(events: EventStore, userId: string, target: Aim, next: EventInput, repeatChanged: boolean): Occurrence {
  const { series, key, current } = target;
  const tzid = series.tzid;
  const timeChanged = timesChanged(current, next);
  const fields = changedFields(current, next);
  const after = target.exceptions.filter((exception) => (exception.originalStart ?? "") >= key);
  const before = cutSeries(events, userId, target);

  if (next.repeat === null) {
    // No longer repeating from here: this occurrence, as changed, is a one-off; the rest goes.
    for (const exception of after) events.remove(userId, exception.id);
    return rowOccurrence(events.create(userId, { ...contentOf(next), tzid }), null);
  }

  // The new series starts at this occurrence's slot, moved as far as the edit moved the occurrence from where it is
  // now (as "all" does). At its slot that is where the edit put it; an exception moved to Tuesday whose end alone
  // changes leaves the new series on Monday, and keeps its own Tuesday as an exception of it.
  const from = current.start;
  const to = timeChanged ? next.start : from;
  const delta = wallDelta(from, to, tzid);
  const slot = { ...contentOf(series), start: key, end: occurrenceEnd(series, key) };
  const allDay = timeChanged ? next.allDay : series.allDay;
  const times = !timeChanged
    ? {}
    : from === key
      ? withTimes(next)
      : { allDay, ...withLength(shift(key, delta, allDay, tzid), next, tzid) };
  const content = { ...slot, ...fields, ...times };
  const end = target.repeat.end;
  const rest: Repeat["end"] = end.type === "count" ? { type: "count", count: end.count - before } : end;
  const repeat = repeatChanged ? next.repeat : { ...rotate(target.repeat, dayShift(from, to, tzid)), end: rest };
  // A new repeat follows this occurrence's date, as the form words it; an unchanged one moves with the series.
  const timing = seriesTiming(content, repeat, repeatChanged ? to : content.start, tzid);
  const created = events.create(userId, { ...contentOf(timing), tzid, rrule: timing.rrule });

  // What the old series had from here on moves over, as far as this occurrence moved, if it still falls on the rule.
  const rekey = (old: string) => shift(old, delta, timing.allDay, tzid);
  const fits = (moved: string) => moved >= timing.start && isGenerated(timing, moved);
  const exdates = series.exdates.filter((date) => date >= key).map(rekey).filter(fits);
  if (exdates.length > 0) events.setExdates(userId, created.id, exdates);
  for (const exception of after) {
    const original = exception.originalStart ?? key;
    const moved = rekey(original);
    if (!fits(moved)) {
      events.remove(userId, exception.id);
      continue;
    }
    events.moveException(userId, exception.id, created.id, moved);
    if (exception.id === target.exception?.id) {
      rewrite(events, userId, exception.id, contentOf(next));
      continue;
    }
    const own: Partial<EventContent> = inherited(exception, series, fields);
    // One still at its slot's times (only its text changed) moves with the series.
    const atSlot =
      exception.allDay === series.allDay && exception.start === original && exception.end === occurrenceEnd(series, original);
    if (atSlot) Object.assign(own, { allDay: timing.allDay, start: moved, end: occurrenceEnd(timing, moved) });
    if (Object.keys(own).length > 0) rewrite(events, userId, exception.id, own);
  }
  return firstOccurrence(events, userId, created.id);
}

// ---------------------------------------------------------------------------
// Delete

/** `DELETE /api/events/:id`. */
export function deleteEvent(ctx: ScopeContext, userId: string, id: number, query: EventDeleteQuery): void {
  ctx.db.transaction((): void => {
    const target = aim(ctx.events, userId, id, query.scope, query.occurrence);
    if (target.kind === "single") {
      ctx.events.remove(userId, target.event.id);
      return;
    }
    const { series, key } = target;
    if (target.scope === "all" || (target.scope === "following" && isFirst(target))) {
      ctx.events.remove(userId, series.id);
      return;
    }
    if (target.scope === "this") {
      if (target.exception) ctx.events.remove(userId, target.exception.id);
      const exdates = [...series.exdates, key];
      // The last occurrence gone: nothing is left of the series.
      if (nextKey(series, series.start, new Set(exdates)) === undefined) ctx.events.remove(userId, series.id);
      else ctx.events.setExdates(userId, series.id, exdates);
      return;
    }
    for (const exception of target.exceptions) {
      if ((exception.originalStart ?? "") >= key) ctx.events.remove(userId, exception.id);
    }
    cutSeries(ctx.events, userId, target);
  })();
}

// ---------------------------------------------------------------------------
// Calendars

/**
 * `DELETE /api/calendars/:id`: the calendar and its events (the cascade),
 * leaving the series and exceptions in other calendars consistent
 * (`EventStore.releaseCalendar`). An occurrence moved out of the calendar
 * stays, as a one-off; one moved into it stays deleted from its series; a
 * series left with no occurrence goes too, as deleting its last occurrence
 * does. `false` when the user has no such calendar. The `conflict` for the
 * user's last calendar rolls everything back.
 */
export function removeCalendar(ctx: ScopeContext & { calendars: CalendarStore }, userId: string, calendarId: number): boolean {
  return ctx.db.transaction((): boolean => {
    for (const id of ctx.events.releaseCalendar(userId, calendarId)) {
      const series = ctx.events.get(userId, id);
      if (series && isSeries(series) && nextKey(series, series.start, new Set(series.exdates)) === undefined) {
        ctx.events.remove(userId, id);
      }
    }
    return ctx.calendars.remove(userId, calendarId);
  })();
}
