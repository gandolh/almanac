# Log

## [2026-10-16] maintenance | Corpus bootstrapped

New repo at `~/projects/almanac`, local git on `main`, no remote (the owner
creates it later). Corpus rules, lint and routing copied from Shelfmark's and
adapted.

## [2026-10-16] decision | The owner's grill settled v1

One question at a time, answered by the owner. Name Almanac. Several users,
each with a private calendar, no sign-up. Named calendars. Common repeats with
three edit scopes. No import. No reminders in v1 (todo filed). Fields: title,
times, all-day, calendar, location, notes, plus search. Phone browser with a
home-screen icon. Display time zone is a per-user setting, Bucharest by
default (the owner first picked fixed Bucharest, then asked for a setting).
Monday, 24h. VPS deploy at port 8797. FullCalendar v7 with our own year view.
Google's keyboard shortcuts. Recorded in [decisions.md](wiki/decisions.md),
[features.md](wiki/features.md), [glossary.md](wiki/glossary.md); the library
survey in [research.md](wiki/research.md).

## [2026-10-16] todo | v1 briefs 01-11 filed

Eleven briefs in `briefs/todo/`, built in waves
`01 → 02 → 03 → 04 ‖ 05 → 06 → 07 ‖ 08 ‖ 09 ‖ 10 ‖ 11`. Brief 05 creates
stubs with fixed signatures so the web briefs after 06 run in parallel
without editing the shell. The two technical checks were answered first
(FullCalendar v7 takes named zones; the server uses `temporal-polyfill`) and
recorded in [architecture.md](wiki/architecture.md).

## [2026-10-16] done | Brief 01: workspace scaffold

Three workspaces on Shelfmark's layout, Fastify health route, SQLite opener
with an empty migration list, Vite page through the `/almanac-api` proxy. The
Ward library came over early for `config.ts`; `ERROR_STATUS` has
`unauthorized`. See [the brief](briefs/done/01-workspace-scaffold.md).

## [2026-10-16] done | Brief 02: accounts and sign-in

Ward auth plugin registered first, origin guard, `currentUserId` in
`auth/guard.ts`, seed, multi-user test helpers (`signInAs`), and the web
login, auth gate and change-password dialog copied from Shelfmark with a
Google-like light palette. See [the brief](briefs/done/02-accounts-and-sign-in.md).

## [2026-10-16] done | Brief 03: calendars, events and settings API

Migration 1, the calendar, event and settings stores, and every route shape,
with repeats refused until brief 04. Per-user scoping with 404 for other
users' ids. New wiki page [data-model.md](wiki/data-model.md). See
[the brief](briefs/done/03-calendars-and-events-api.md).

## [2026-10-16] done | Brief 04: repeating events

Repeat presets as RRULEs, server-side expansion with rrule-temporal in the
series' zone, and the three edit scopes for edit and delete. The as-built
rules are in [recurrence.md](wiki/recurrence.md). See
[the brief](briefs/done/04-repeating-events.md).

## [2026-10-16] done | Brief 05: app shell, routes, dates and tokens

Google-style top bar, sidebar with mini-month, drawer on phones, view routes
`/<view>/y/m/d`, `dates.ts` on Temporal, calendar and settings data hooks,
shortcuts and commands, Popover, Dialog, Toast, MonthGrid, the home-screen
icon, and stubs for briefs 06-10. `.gitignore` fixed so `web/src/data/` is
tracked. See [the brief](briefs/done/05-app-shell.md).

## [2026-10-16] done | Brief 06: day, week and month views

FullCalendar v7 with the Monarch theme on our tokens, the occurrences data
layer, the details popover, linkify, the edit-scope dialog, drag, drop and
resize. See [the brief](briefs/done/06-day-week-month-views.md).

## [2026-10-16] done | Brief 08: year view

Twelve mini-months with dots on days that have events, a day list in a
popover, links to the day and month. See [the brief](briefs/done/08-year-view.md).

## [2026-10-16] done | Brief 11: container, VPS stack, Ward entry, owner docs

Dockerfile and compose (port 8797), the vps-deploy stack (`8e247a3`) and the
local Ward seed entry (`22e1fd2`), both unpushed, `docs/owner-setup.md` and
the README. See [the brief](briefs/done/11-deploy-and-docs.md).

## [2026-10-16] done | Brief 10: search

Top-bar search field, `/` to focus, results grouped by date, a click opens
the day. See [the brief](briefs/done/10-search.md).

## [2026-10-16] done | Brief 09: managing calendars, and the time zone setting

"My calendars" with show/hide, rename, colour and delete, a new-calendar
dialog, and the time zone dialog in the account menu. See
[the brief](briefs/done/09-calendars-and-time-zone.md).

## [2026-10-16] done | Brief 07: creating and editing events

Quick create, the event form, the repeat picker, the 24-hour time field, `c`
to create, scope questions on series edits. See
[the brief](briefs/done/07-creating-and-editing-events.md).
