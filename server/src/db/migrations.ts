import type { Database } from "better-sqlite3";

/**
 * Applied in order on boot, tracked in `PRAGMA user_version` (`migrate`).
 * Never edit a shipped entry; append a new one with a comment naming its
 * brief.
 *
 * `openDb` runs the vendored auth library's own migrations first, so
 * `auth_users`, which every table here hangs off, exists before these run.
 */
export const migrations: readonly string[] = [
  // Brief 03: calendars, events (one-offs, series and their exceptions) and the display time zone.
  `
  CREATE TABLE calendars (
    id          INTEGER PRIMARY KEY,
    user_id     TEXT    NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    name        TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    -- A key of CALENDAR_COLORS (shared/src/calendar.ts), checked by the schema
    -- rather than here, so the palette can grow without rebuilding the table.
    color       TEXT    NOT NULL,
    visible     INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
    position    INTEGER NOT NULL,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );
  CREATE INDEX calendars_user_position ON calendars (user_id, position);

  CREATE TABLE events (
    id              INTEGER PRIMARY KEY,
    user_id         TEXT    NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    calendar_id     INTEGER NOT NULL REFERENCES calendars (id) ON DELETE CASCADE,
    title           TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    location        TEXT    NOT NULL DEFAULT '',
    notes           TEXT    NOT NULL DEFAULT '',
    all_day         INTEGER NOT NULL CHECK (all_day IN (0, 1)),
    -- A timed event: UTC epoch milliseconds, end exclusive.
    start_at        INTEGER,
    end_at          INTEGER,
    -- An all-day event: YYYY-MM-DD, end exclusive (one day ends the next day).
    start_date      TEXT,
    end_date        TEXT,
    -- The user's display time zone when the row was created: a series'
    -- wall-clock times belong to it (corpus/wiki/recurrence.md).
    tzid            TEXT    NOT NULL,
    -- Set on a series only (brief 04).
    rrule           TEXT,
    -- A series' deleted occurrences, as a JSON array of occurrence keys.
    exdates         TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(exdates) AND json_type(exdates) = 'array'),
    -- An exception: the series it belongs to and the occurrence key it replaces.
    series_id       INTEGER REFERENCES events (id) ON DELETE CASCADE,
    original_start  TEXT,
    -- Title, location and notes folded for search (store/search-text.ts).
    search_text     TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    -- Exactly one pair is set, the one all_day says, and it ends after it starts.
    CHECK (
      (all_day = 0 AND start_at IS NOT NULL AND end_at IS NOT NULL AND start_date IS NULL AND end_date IS NULL
        AND end_at > start_at)
      OR
      (all_day = 1 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_at IS NULL AND end_at IS NULL
        AND end_date > start_date)
    ),
    CHECK ((series_id IS NULL) = (original_start IS NULL)),
    CHECK (series_id IS NULL OR rrule IS NULL)
  );
  CREATE INDEX events_user_start_at ON events (user_id, start_at);
  CREATE INDEX events_user_start_date ON events (user_id, start_date);
  -- A series' exceptions, at most one per occurrence key; also the cascade's lookup.
  CREATE UNIQUE INDEX events_series ON events (series_id, original_start);
  CREATE INDEX events_user_series_rows ON events (user_id, rrule) WHERE rrule IS NOT NULL;
  -- Deleting a calendar finds its events through this (the cascade).
  CREATE INDEX events_calendar ON events (calendar_id);

  CREATE TABLE user_settings (
    user_id    TEXT PRIMARY KEY NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    time_zone  TEXT NOT NULL DEFAULT 'Europe/Bucharest'
  );
  `,
];

/**
 * Brings the schema up to `list.length`, tracked in `PRAGMA user_version`.
 *
 * Reading the version and applying what is missing is one `BEGIN IMMEDIATE`
 * transaction: two processes opening a fresh database at once take turns,
 * and the second finds the version the first wrote, instead of both reading
 * 0 and both running entry 1. An entry that fails rolls back the whole run.
 * Inside a caller's transaction (`migrateAll`) it is a savepoint of that.
 */
export function migrate(db: Database, list: readonly string[] = migrations): void {
  db.transaction(() => {
    const current = db.pragma("user_version", { simple: true }) as number;
    if (current > list.length) {
      throw new Error(
        `The database is at schema version ${current}, but this server only knows ${list.length}. Run a newer server.`,
      );
    }
    for (const sql of list.slice(current)) db.exec(sql);
    if (list.length > current) db.pragma(`user_version = ${list.length}`);
  }).immediate();
}
