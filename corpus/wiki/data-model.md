---
summary: The SQLite schema as shipped by brief 03 on 2026-10-16. Calendars, events (one-offs, series and exceptions in one table, timed as UTC ms or all-day as dates, the tzid that anchors repeats, exdates as JSON) and user settings; the CHECKs and indexes; the wire format for instants, dates and occurrence keys; why there is no CHECK on colour; and how every row is scoped to a user.
updated: 2026-10-16
---

# Data model

Migration 1 in `server/src/db/migrations.ts` (brief 03). The vendored Ward
library keeps its own tables (`auth_users`, `auth_sessions`,
`auth_ward_links`) and its own version table; `openDb` runs its migration
first so the foreign keys below always have a target. Both runners go in one
`BEGIN IMMEDIATE` transaction (`migrateAll`), so two processes opening a
fresh database take turns instead of both running migration 1. The code
wins where this page and it disagree.

## Tables

**`calendars`**: `id`, `user_id` → `auth_users(id)` ON DELETE CASCADE,
`name` (1-60), `color` (a key of `CALENDAR_COLORS`, checked by zod only, so
the palette can grow without rebuilding the table), `visible` 0/1,
`position`, `created_at`, `updated_at` (ISO text). A user always has at
least one: `GET /api/calendars` creates "Personal" in blue when there is
none, and the last one can't be deleted (409 `conflict`).

**`events`**: one table for every kind of event row.

| Kind | `rrule` | `series_id` / `original_start` |
|---|---|---|
| One-off | NULL | NULL |
| Series | the RRULE line | NULL |
| Exception | NULL | the series and the occurrence key it replaces |

Other columns: `user_id`, `calendar_id` → `calendars` ON DELETE CASCADE,
`title` (1-200), `location`, `notes`, `all_day`; timed rows set `start_at`
and `end_at` (UTC ms), all-day rows set `start_date` and `end_date`
(`YYYY-MM-DD`, end exclusive), never both; `tzid` (the user's display time
zone when the row was written, which anchors a series' wall-clock times);
`exdates` (JSON array of deleted occurrence keys); `search_text` (title,
location and notes, lower-cased with diacritics stripped, so "sedinta" finds
"Ședință"). Deleting a series cascades to its exceptions. Deleting a
calendar first keeps the rest consistent (`removeCalendar` in
`server/src/recurrence/scopes.ts`): an exception in another calendar whose
series goes becomes a one-off, an exception that goes adds its key to its
series' `exdates` elsewhere, and a series left with no occurrence goes too.

**`user_settings`**: `user_id` PK, `time_zone` (default
`Europe/Bucharest`). No row means the default.

## Wire format

- A timed instant is whole seconds in UTC: `2026-10-16T07:00:00Z`.
- An all-day value is a date; ranges are end-exclusive.
- An occurrence key is the occurrence's original start in that same format,
  so an unmoved occurrence's `start` equals its key.
- Occurrence ids: `e12` for a stored row, `s7:<key>` for an occurrence a
  series generates.
- All-day rows match an instant range after converting it to dates in the
  user's display time zone (`allDayRange` in `shared/src/time.ts`).

## Scoping

Every store method takes the user id, and another user's ids behave as
missing, so the API answers 404 rather than 403.
