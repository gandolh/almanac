import {
  DEFAULT_CALENDAR_COLOR,
  DEFAULT_CALENDAR_NAME,
  nextCalendarColor,
  type Calendar,
  type CalendarColor,
  type CalendarCreate,
  type CalendarPatch,
} from "@almanac/shared";
import type { Db } from "../db/open.js";
import { ApiError } from "../errors.js";

/**
 * The calendars store: the only module that runs SQL on `calendars`. Every
 * method is scoped by the user: another user's id is the same as no such
 * calendar.
 *
 * Inputs are already parsed with the shared schemas; the store applies the
 * defaults and sets the position and the times.
 */
export interface CalendarStore {
  /** The user's calendars, by position. */
  list(userId: string): Calendar[];
  get(userId: string, id: number): Calendar | undefined;
  /** Goes last. Left out, the colour is the first one the user's calendars don't have. */
  create(userId: string, input: CalendarCreate): Calendar;
  /** `undefined` when the user has no such calendar. */
  update(userId: string, id: number, patch: CalendarPatch): Calendar | undefined;
  /**
   * `false` when the user has no such calendar. Its events go with it
   * (cascade). Throws a `conflict` `ApiError` for the user's last calendar:
   * a user always has one to put events on.
   */
  remove(userId: string, id: number): boolean;
  /** Creates "Personal" in blue when the user has no calendar (a new user). True when it did. */
  ensureDefault(userId: string): boolean;
}

/** A `calendars` row as the selects return it: camelCase aliases, `visible` still 0/1. */
type CalendarRow = Omit<Calendar, "visible" | "color"> & { visible: number; color: string };

const SELECT = `
  SELECT id, name, color, visible, position, created_at AS createdAt, updated_at AS updatedAt
  FROM calendars`;

function toCalendar(row: CalendarRow): Calendar {
  return { ...row, color: row.color as CalendarColor, visible: row.visible === 1 };
}

export function createCalendarStore(db: Db, now: () => Date = () => new Date()): CalendarStore {
  const listRows = db.prepare<[string], CalendarRow>(`${SELECT} WHERE user_id = ? ORDER BY position, id`);
  const getRow = db.prepare<[string, number], CalendarRow>(`${SELECT} WHERE user_id = ? AND id = ?`);
  const countRows = db.prepare<[string], { count: number }>("SELECT COUNT(*) AS count FROM calendars WHERE user_id = ?");
  const insertRow = db.prepare<[Record<string, unknown>]>(`
    INSERT INTO calendars (user_id, name, color, visible, position, created_at, updated_at)
    VALUES (@userId, @name, @color, @visible,
            (SELECT COALESCE(MAX(position), -1) + 1 FROM calendars WHERE user_id = @userId),
            @at, @at)`);
  const updateRow = db.prepare<[Record<string, unknown>]>(`
    UPDATE calendars SET name = @name, color = @color, visible = @visible, updated_at = @updatedAt
    WHERE user_id = @userId AND id = @id`);
  const deleteRow = db.prepare<[string, number]>("DELETE FROM calendars WHERE user_id = ? AND id = ?");

  const list = (userId: string) => listRows.all(userId).map(toCalendar);

  function get(userId: string, id: number): Calendar | undefined {
    const row = getRow.get(userId, id);
    return row && toCalendar(row);
  }

  /** `get` for a row that was just written in the same transaction. */
  function reread(userId: string, id: number): Calendar {
    const calendar = get(userId, id);
    if (!calendar) throw new Error(`Calendar ${id} vanished inside its own transaction.`);
    return calendar;
  }

  const create = db.transaction((userId: string, input: CalendarCreate): Calendar => {
    const color = input.color ?? nextCalendarColor(list(userId).map((calendar) => calendar.color));
    const id = Number(
      insertRow.run({
        userId,
        name: input.name,
        color,
        visible: input.visible === false ? 0 : 1,
        at: now().toISOString(),
      }).lastInsertRowid,
    );
    return reread(userId, id);
  });

  const update = db.transaction((userId: string, id: number, patch: CalendarPatch): Calendar | undefined => {
    const current = get(userId, id);
    if (!current) return undefined;
    if (patch.name === undefined && patch.color === undefined && patch.visible === undefined) return current;
    updateRow.run({
      userId,
      id,
      name: patch.name ?? current.name,
      color: patch.color ?? current.color,
      visible: (patch.visible ?? current.visible) ? 1 : 0,
      updatedAt: now().toISOString(),
    });
    return reread(userId, id);
  });

  const remove = db.transaction((userId: string, id: number): boolean => {
    if (!getRow.get(userId, id)) return false;
    if ((countRows.get(userId)?.count ?? 0) <= 1) {
      throw new ApiError("conflict", "This is your only calendar. Make another one before deleting it.");
    }
    return deleteRow.run(userId, id).changes > 0;
  });

  const ensureDefault = db.transaction((userId: string): boolean => {
    if ((countRows.get(userId)?.count ?? 0) > 0) return false;
    create(userId, { name: DEFAULT_CALENDAR_NAME, color: DEFAULT_CALENDAR_COLOR });
    return true;
  });

  return {
    list,
    get,
    create: (userId, input) => create(userId, input),
    update: (userId, id, patch) => update(userId, id, patch),
    remove: (userId, id) => remove(userId, id),
    ensureDefault: (userId) => ensureDefault(userId),
  };
}
