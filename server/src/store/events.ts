import { formatInstant, parseInstant, type DateRange } from "@almanac/shared";
import type { Db } from "../db/open.js";
import { ApiError } from "../errors.js";
import { eventSearchText, foldSearchText } from "./search-text.js";

/**
 * The events store: the only module that runs SQL on `events` (it reads
 * `calendars` only to check a calendar is the user's). Every method is scoped
 * by the user: another user's id is the same as no such event.
 *
 * It stores one-off events, series (a row with `rrule`) and exceptions (a row
 * with `seriesId` and `originalStart`), but knows nothing about repeating:
 * expanding and the edit scopes are brief 04's, built on the low-level writes
 * at the end of the interface. Inputs are already validated
 * (`eventInputSchema`); the store sets `search_text` and the times on every
 * write.
 */
export interface EventStore {
  get(userId: string, id: number): EventRecord | undefined;
  /**
   * A one-off event, or a series when `rrule` is given. Throws a `not_found`
   * `ApiError` for a calendar that is not the user's.
   */
  create(userId: string, event: NewEvent): EventRecord;
  /**
   * Changes what is given and keeps the rest; `tzid`, `rrule`, `exdates` and
   * the series link stay. `undefined` when the user has no such event.
   * Throws a `not_found` `ApiError` for a calendar that is not the user's.
   */
  update(userId: string, id: number, changes: Partial<EventContent>): EventRecord | undefined;
  /** `false` when the user has no such event. A series takes its exceptions with it (cascade). */
  remove(userId: string, id: number): boolean;
  /** Rows with no `rrule` (one-off events and exceptions) overlapping the range, by id. */
  listInRange(userId: string, range: EventRange): EventRecord[];
  /** Series rows (`rrule` set) that start before the range ends, by id. Whether they reach into it is brief 04's to work out. */
  listSeries(userId: string, range: EventRange): EventRecord[];
  /** A series' exceptions wherever they are, by `originalStart`. */
  listExceptions(userId: string, seriesId: number): EventRecord[];
  /** Every row whose title, location or notes contain `query`, case and diacritics folded (`foldSearchText`), by id. */
  search(userId: string, query: string): EventRecord[];

  // Low-level writes for brief 04's edit scopes. Each is one statement; the caller holds the transaction.

  /** Replaces a series' excluded occurrence keys (stored de-duplicated, sorted). `undefined` when there is no such event. */
  setExdates(userId: string, id: number, exdates: readonly string[]): EventRecord | undefined;
  /**
   * Sets or clears a row's `rrule`. `undefined` when there is no such event.
   * An exception cannot have one (the schema refuses it).
   */
  setRrule(userId: string, id: number, rrule: string | null): EventRecord | undefined;
  /**
   * Stores an exception: the occurrence `originalStart` of the series, as
   * `content`, in the series' `tzid`. `undefined` when the user has no such
   * series (no row, or a row without `rrule`). Throws a `not_found`
   * `ApiError` for a calendar that is not the user's, and the database's
   * unique error when the occurrence already has an exception (update that
   * one instead).
   */
  insertException(userId: string, seriesId: number, originalStart: string, content: EventContent): EventRecord | undefined;
}

/** What an event is: the fields the API sends, as `eventInputSchema` leaves them. */
export interface EventContent {
  calendarId: number;
  title: string;
  location: string;
  notes: string;
  allDay: boolean;
  /** An instant (`2026-10-16T07:00:00Z`) for a timed event, a date for an all-day one. */
  start: string;
  /** As `start`. Exclusive for an all-day event: a one-day event on the 16th ends on the 17th. */
  end: string;
}

/** A new row: its content, the zone its wall-clock times belong to (the user's display time zone), and `rrule` for a series. */
export interface NewEvent extends EventContent {
  tzid: string;
  rrule?: string | null;
}

/** A stored row. */
export interface EventRecord extends EventContent {
  id: number;
  tzid: string;
  /** Set on a series only. */
  rrule: string | null;
  /** A series' deleted occurrences, as occurrence keys. Empty on everything else. */
  exdates: string[];
  /** Set on an exception only, both together. */
  seriesId: number | null;
  originalStart: string | null;
  /** UTC ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

/**
 * A range the views ask for: the instants `[from, to)` as epoch ms, and the
 * same range as the dates it covers in the user's display time zone, which
 * all-day rows are matched on (`allDayRange` in `@almanac/shared`).
 */
export interface EventRange {
  from: number;
  to: number;
  dates: DateRange;
}

/** An `events` row as the selects return it: camelCase aliases, the timing columns and JSON still raw. */
interface EventRow {
  id: number;
  calendarId: number;
  title: string;
  location: string;
  notes: string;
  allDay: number;
  startAt: number | null;
  endAt: number | null;
  startDate: string | null;
  endDate: string | null;
  tzid: string;
  rrule: string | null;
  exdates: string;
  seriesId: number | null;
  originalStart: string | null;
  createdAt: string;
  updatedAt: string;
}

const SELECT = `
  SELECT id, calendar_id AS calendarId, title, location, notes, all_day AS allDay,
         start_at AS startAt, end_at AS endAt, start_date AS startDate, end_date AS endDate,
         tzid, rrule, exdates, series_id AS seriesId, original_start AS originalStart,
         created_at AS createdAt, updated_at AS updatedAt
  FROM events`;

function toRecord(row: EventRow): EventRecord {
  const allDay = row.allDay === 1;
  return {
    id: row.id,
    calendarId: row.calendarId,
    title: row.title,
    location: row.location,
    notes: row.notes,
    allDay,
    start: allDay ? (row.startDate ?? "") : formatInstant(row.startAt ?? 0),
    end: allDay ? (row.endDate ?? "") : formatInstant(row.endAt ?? 0),
    tzid: row.tzid,
    rrule: row.rrule,
    exdates: JSON.parse(row.exdates) as string[],
    seriesId: row.seriesId,
    originalStart: row.originalStart,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The named parameters for the content columns: one timing pair set, the other NULL, and the folded search text. */
function contentParams(content: EventContent): Record<string, unknown> {
  return {
    calendarId: content.calendarId,
    title: content.title,
    location: content.location,
    notes: content.notes,
    allDay: content.allDay ? 1 : 0,
    startAt: content.allDay ? null : parseInstant(content.start),
    endAt: content.allDay ? null : parseInstant(content.end),
    startDate: content.allDay ? content.start : null,
    endDate: content.allDay ? content.end : null,
    searchText: eventSearchText(content),
  };
}

const CONTENT_KEYS = ["calendarId", "title", "location", "notes", "allDay", "start", "end"] as const;

export function createEventStore(db: Db, now: () => Date = () => new Date()): EventStore {
  const getRow = db.prepare<[string, number], EventRow>(`${SELECT} WHERE user_id = ? AND id = ?`);
  const ownsCalendar = db.prepare<[string, number], { id: number }>(
    "SELECT id FROM calendars WHERE user_id = ? AND id = ?",
  );

  const insertRow = db.prepare<[Record<string, unknown>]>(`
    INSERT INTO events (user_id, calendar_id, title, location, notes, all_day, start_at, end_at, start_date, end_date,
                        tzid, rrule, series_id, original_start, search_text, created_at, updated_at)
    VALUES (@userId, @calendarId, @title, @location, @notes, @allDay, @startAt, @endAt, @startDate, @endDate,
            @tzid, @rrule, @seriesId, @originalStart, @searchText, @at, @at)`);
  const updateRow = db.prepare<[Record<string, unknown>]>(`
    UPDATE events SET calendar_id = @calendarId, title = @title, location = @location, notes = @notes,
                      all_day = @allDay, start_at = @startAt, end_at = @endAt, start_date = @startDate,
                      end_date = @endDate, search_text = @searchText, updated_at = @updatedAt
    WHERE user_id = @userId AND id = @id`);
  const deleteRow = db.prepare<[string, number]>("DELETE FROM events WHERE user_id = ? AND id = ?");
  const updateExdates = db.prepare<[string, string, string, number]>(
    "UPDATE events SET exdates = ?, updated_at = ? WHERE user_id = ? AND id = ?",
  );
  const updateRrule = db.prepare<[string | null, string, string, number]>(
    "UPDATE events SET rrule = ?, updated_at = ? WHERE user_id = ? AND id = ?",
  );

  // Timed and all-day rows apart, so each half uses its own index.
  const timedInRange = db.prepare<[string, number, number], EventRow>(
    `${SELECT} WHERE user_id = ? AND rrule IS NULL AND all_day = 0 AND start_at < ? AND end_at > ? ORDER BY id`,
  );
  const allDayInRange = db.prepare<[string, string, string], EventRow>(
    `${SELECT} WHERE user_id = ? AND rrule IS NULL AND all_day = 1 AND start_date < ? AND end_date > ? ORDER BY id`,
  );
  const seriesBefore = db.prepare<[string, number, string], EventRow>(
    `${SELECT} WHERE user_id = ? AND rrule IS NOT NULL
       AND ((all_day = 0 AND start_at < ?) OR (all_day = 1 AND start_date < ?))
     ORDER BY id`,
  );
  const exceptionsOf = db.prepare<[string, number], EventRow>(
    `${SELECT} WHERE user_id = ? AND series_id = ? ORDER BY original_start`,
  );
  const searchRows = db.prepare<[string, string], EventRow>(
    `${SELECT} WHERE user_id = ? AND instr(search_text, ?) > 0 ORDER BY id`,
  );

  function get(userId: string, id: number): EventRecord | undefined {
    const row = getRow.get(userId, id);
    return row && toRecord(row);
  }

  /** `get` for a row that was just written in the same transaction. */
  function reread(userId: string, id: number): EventRecord {
    const event = get(userId, id);
    if (!event) throw new Error(`Event ${id} vanished inside its own transaction.`);
    return event;
  }

  function checkCalendar(userId: string, calendarId: number): void {
    if (!ownsCalendar.get(userId, calendarId)) throw new ApiError("not_found", "There is no such calendar.");
  }

  function insert(userId: string, content: EventContent, extra: Record<string, unknown>): EventRecord {
    checkCalendar(userId, content.calendarId);
    const params = { ...contentParams(content), userId, at: now().toISOString(), ...extra };
    return reread(userId, Number(insertRow.run(params).lastInsertRowid));
  }

  const create = db.transaction(
    (userId: string, event: NewEvent): EventRecord =>
      insert(userId, event, { tzid: event.tzid, rrule: event.rrule ?? null, seriesId: null, originalStart: null }),
  );

  const update = db.transaction(
    (userId: string, id: number, changes: Partial<EventContent>): EventRecord | undefined => {
      const current = get(userId, id);
      if (!current) return undefined;
      const next: EventContent = { ...current };
      for (const key of CONTENT_KEYS) {
        if (changes[key] !== undefined) Object.assign(next, { [key]: changes[key] });
      }
      if (CONTENT_KEYS.every((key) => next[key] === current[key])) return current;
      if (next.calendarId !== current.calendarId) checkCalendar(userId, next.calendarId);
      updateRow.run({ ...contentParams(next), userId, id, updatedAt: now().toISOString() });
      return reread(userId, id);
    },
  );

  const insertException = db.transaction(
    (userId: string, seriesId: number, originalStart: string, content: EventContent): EventRecord | undefined => {
      const series = get(userId, seriesId);
      if (!series || series.rrule === null) return undefined;
      return insert(userId, content, { tzid: series.tzid, rrule: null, seriesId, originalStart });
    },
  );

  function setExdates(userId: string, id: number, exdates: readonly string[]): EventRecord | undefined {
    const stored = JSON.stringify([...new Set(exdates)].sort());
    if (updateExdates.run(stored, now().toISOString(), userId, id).changes === 0) return undefined;
    return reread(userId, id);
  }

  function setRrule(userId: string, id: number, rrule: string | null): EventRecord | undefined {
    if (updateRrule.run(rrule, now().toISOString(), userId, id).changes === 0) return undefined;
    return reread(userId, id);
  }

  function search(userId: string, query: string): EventRecord[] {
    const needle = foldSearchText(query);
    // instr with an empty needle matches every row: a query of only accents finds nothing.
    if (needle === "") return [];
    return searchRows.all(userId, needle).map(toRecord);
  }

  return {
    get,
    create: (userId, event) => create(userId, event),
    update: (userId, id, changes) => update(userId, id, changes),
    remove: (userId, id) => deleteRow.run(userId, id).changes > 0,
    listInRange: (userId, { from, to, dates }) =>
      [...timedInRange.all(userId, to, from), ...allDayInRange.all(userId, dates.end, dates.start)].map(toRecord),
    listSeries: (userId, { to, dates }) => seriesBefore.all(userId, to, dates.end).map(toRecord),
    listExceptions: (userId, seriesId) => exceptionsOf.all(userId, seriesId).map(toRecord),
    search,
    setExdates,
    setRrule,
    insertException: (userId, seriesId, originalStart, content) =>
      insertException(userId, seriesId, originalStart, content),
  };
}
