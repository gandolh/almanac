---
summary: The SQLite schema as shipped by brief 03 on 2026-10-16, with brief 14's push subscriptions, brief 15's reminder column and brief 16's sent log (2026-10-27). Calendars, events (one-offs, series and exceptions in one table, timed as UTC ms or all-day as dates, the tzid that anchors repeats, exdates as JSON, reminder_minutes) and user settings; push_subscriptions; reminders_sent; the CHECKs and indexes; the wire format for instants, dates and occurrence keys; why there is no CHECK on colour or reminder; and how every row is scoped to a user.
updated: 2026-10-27
---

# Data model

Migration 1 in `server/src/db/migrations.ts` (brief 03); migration 2 adds
`push_subscriptions` (brief 14), migration 3 `events.reminder_minutes`
(brief 15) and migration 4 `reminders_sent` (brief 16). The vendored Ward
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
"Ședință"); `reminder_minutes` (brief 15: minutes before the start, NULL for
none; an all-day row counts back from 00:00 of its start date in the user's
display time zone, so 900 is 09:00 the day before and -540 is 09:00 on the
day). The allowed reminders are checked by zod only (`TIMED_REMINDERS`,
`ALL_DAY_REMINDERS`), as colours are. An exception carries its own reminder,
like its title. Deleting a series cascades to its exceptions. Deleting a
calendar first keeps the rest consistent (`removeCalendar` in
`server/src/recurrence/scopes.ts`): an exception in another calendar whose
series goes becomes a one-off, an exception that goes adds its key to its
series' `exdates` elsewhere, and a series left with no occurrence goes too.

**`user_settings`**: `user_id` PK, `time_zone` (default
`Europe/Bucharest`). No row means the default.

**`push_subscriptions`** (brief 14): `id`, `user_id` → `auth_users(id)` ON
DELETE CASCADE, `endpoint` (unique: one browser's address at its push
service), `p256dh` and `auth` (the browser's keys), `created_at`,
`last_success_at`. An endpoint belongs to whoever saved it last; a user keeps
the newest five (`PUSH_SUBSCRIPTIONS_PER_USER`), and id order is save order.
A push service's 404 or 410 deletes the row.

**`reminders_sent`** (brief 16): `event_id` → `events(id)` ON DELETE CASCADE,
`occurrence_start` (the occurrence's start: a series' key for one it
generates, the row's own start for a one-off or an exception), `sent_at`
(epoch ms, indexed). The primary key is the first two, so a reminder is
claimed once, before it is sent. Rows older than three days are dropped.

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
