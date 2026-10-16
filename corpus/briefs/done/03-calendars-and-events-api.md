# Task 03: Calendars, events and settings: schema, stores and API

## Context

The data layer and the HTTP contract the web app is built on. Read
[glossary.md](../../wiki/glossary.md) (calendar, event, series, occurrence,
exception, edit scope, display time zone), [features.md](../../wiki/features.md)
and [recurrence.md](../../wiki/recurrence.md). This brief stores repeat data
and defines every route shape, but repeating itself is brief 04: here the
routes accept `repeat: null` only and answer 400 `validation` for anything
else, and the occurrences route returns one-off events only.

Every row belongs to one user and every query is scoped by
`currentUserId(request)` (brief 02). Another user's id is answered with 404,
never 403, so ids don't leak.

Depends on: 02. Patterns: Shelfmark's `server/src/store/books.ts`,
`server/src/routes/books.ts`, `shared/src/book.ts` (`../shelfmark`).

## Files you OWN

```
shared/src/calendar.ts  shared/src/event.ts  shared/src/settings.ts
shared/src/search.ts  shared/src/time.ts  shared/src/*.test.ts  shared/src/index.ts
server/src/db/migrations.ts   (append the first migration)
server/src/store/calendars.ts  server/src/store/events.ts  server/src/store/settings.ts
server/src/store/search-text.ts  server/src/store/*.test.ts
server/src/routes/calendars.ts  server/src/routes/events.ts  server/src/routes/occurrences.ts
server/src/routes/search.ts  server/src/routes/settings.ts  server/src/routes/*.test.ts
server/src/app.ts             (add stores to FeatureContext and routes to FEATURES)
```

## Files you must NOT touch

`server/src/auth/*`, `server/vendor/*`, `web/`.

## What to do

1. Migration 1 (comment it "brief 03"):
   - `calendars`: `id` INTEGER PK, `user_id` TEXT NOT NULL REFERENCES
     `auth_users(id)` ON DELETE CASCADE (check the vendored table's id
     column), `name` TEXT NOT NULL CHECK length 1-60, `color` TEXT NOT NULL
     (one of the palette keys), `visible` INTEGER NOT NULL DEFAULT 1,
     `position` INTEGER NOT NULL, `created_at`, `updated_at`.
   - `events`: `id` INTEGER PK, `user_id`, `calendar_id` REFERENCES
     `calendars` ON DELETE CASCADE, `title` (1-200), `location`, `notes`
     (text, default ''), `all_day` 0/1, `start_at`/`end_at` INTEGER (UTC ms,
     timed events), `start_date`/`end_date` TEXT (`YYYY-MM-DD`, all-day, end
     exclusive), `tzid` TEXT NOT NULL (the user's display time zone when the
     row was created; anchors repeats), `rrule` TEXT NULL, `exdates` TEXT NOT
     NULL DEFAULT '[]' (JSON array of occurrence keys), `series_id` INTEGER
     NULL REFERENCES `events` ON DELETE CASCADE, `original_start` TEXT NULL,
     `search_text` TEXT NOT NULL, `created_at`, `updated_at`. CHECKs: exactly
     one of the timed pair or the date pair is set, end after start, an
     exception has both `series_id` and `original_start`, an exception has no
     `rrule`. Indexes for (user_id, start_at), (user_id, start_date),
     (series_id), and (user_id, rrule) where rrule is not null.
   - `user_settings`: `user_id` PK, `time_zone` TEXT NOT NULL DEFAULT
     'Europe/Bucharest'.
2. `shared/src/time.ts`: the occurrence key format (`2026-10-16T07:00:00Z` for
   timed, `2026-10-16` for all-day), `isIanaZone(zone)` via `Intl`, and
   `DEFAULT_TIME_ZONE`. `shared/src/calendar.ts`: `CALENDAR_COLORS`, ten keys
   with hex values (blue, teal, green, olive, yellow, orange, red, pink,
   purple, graphite; pick calm Google-like values), and the zod schemas.
   `shared/src/event.ts`: `repeatSchema` (`{ freq: "daily" | "weekdays" |
   "weekly" | "monthly" | "yearly", byDay?: Weekday[] (weekly only), end:
   { type: "never" } | { type: "until", date } | { type: "count", count:
   1-730 } }`), `eventInputSchema` (calendarId, title, location, notes,
   allDay, start, end, repeat nullable; timed start/end are ISO instants,
   all-day are dates), `eventPatchSchema` (`{ scope?: "this" | "following" |
   "all", occurrence?: key, changes: partial input }`), `occurrenceSchema`:
   `{ id, eventId, seriesId, originalStart, calendarId, title, location,
   notes, allDay, start, end, repeat }` where `id` is a stable string key
   (`e12` for a row, `s7:<key>` for a generated occurrence), timed
   `start`/`end` are UTC ISO strings and all-day ones are dates.
   `settings.ts`, `search.ts`: their request and response schemas.
3. Stores (`createXStore(db, now)`, prepared statements, the only SQL):
   - calendars: list (ordered by position), create, update (name, color,
     visible), delete (refuse the user's last calendar with a `conflict`
     error; add `conflict: 409` to `ERROR_STATUS`), `ensureDefault(userId)`
     creating "Personal" in blue when the user has none.
   - events: get, create, update, delete, list one-offs and exceptions
     overlapping a range, list series rows (rrule not null) that start before
     the range end, plus the low-level writes brief 04 needs (set exdates,
     set rrule, insert exception). Sets `search_text` on every write.
   - settings: get (default when no row), set.
   - `search-text.ts`: lower case, NFD, strip combining marks, so "sedinta"
     matches "Ședință".
4. Routes (`/api/...`, every one signed in, zod `parse` as Shelfmark):
   - `GET /api/calendars` (calls `ensureDefault` first), `POST`, `PATCH /:id`,
     `DELETE /:id`.
   - `POST /api/events`, `PATCH /api/events/:id`, `DELETE /api/events/:id`
     (query `scope`, `occurrence`). The calendar must be the user's. New rows
     take `tzid` from the user's settings.
   - `GET /api/occurrences?from&to` (ISO instants, `to` after `from`, span at
     most 400 days): one-off events overlapping the range as occurrences.
   - `GET /api/search?q` (1-100 chars): up to 50 of the user's events whose
     `search_text` contains the folded query, ordered by start. Brief 04
     changes what a series contributes.
   - `GET /api/settings`, `PATCH /api/settings` (`timeZone` must pass
     `isIanaZone`).
5. Tests: store tests per table; route tests through `startSignedInApp`,
   including a second user who gets 404 on the first user's calendar and
   event and sees none of their occurrences or search hits; deleting a
   calendar deletes its events; the last calendar can't be deleted; an
   all-day event spans dates correctly; a timed event returned as `…Z`.

## Acceptance

- typecheck, lint, test and build pass.
- Every route rejects a missing session with 401 and another user's ids with
  404.
- Hand back the exact exported schema and type names and the store
  interfaces for briefs 04-11.

## Outcome

_2026-10-16_. Built as specified, 224 tests. Outside the list: `db/open.ts`
runs the Ward library's migration before Almanac's so the `auth_users`
foreign keys always resolve; the root `package.json` gained `pretest: tsc -b
shared`; the controller updated `auth/accounts.test.ts`, which assumed an
empty migration list. No CHECK on `calendars.color` (zod checks it).
`isIanaZone` keeps the name as given rather than Intl's canonical one
(`Europe/Kyiv` stays). POST and PATCH answer an occurrence. Schema:
[data-model.md](../../wiki/data-model.md).
