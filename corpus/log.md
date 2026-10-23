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

## [2026-10-16] maintenance | Review round and fixes

Three read-only finders (web wiring on Opus, server correctness and
conventions on Sonnet) and a browser walkthrough of every flow at 1440×900
and 390×844. No Critical findings; all ten browser flows passed. Fixed in
three lanes: shortcuts after a checkbox click, the phone time list, a
failed delete hidden under the form, quick-create edge cases, the drawer's
Esc, clipped titles, the opening scroll, Change password on the shared
Dialog, a compact phone title, FullCalendar lazy-loaded (entry 734 → 446
kB), event length and repeat-end caps, a series that won't expand skipped
instead of a 500, calendar deletes keeping moved occurrences consistent,
"all" and "following" measured from an exception's current start, search
keeping the 50 closest to now, migrations in one immediate transaction.
The DST-gap skip is accepted ([recurrence.md](wiki/recurrence.md)). The
remote `gandolh/almanac` was added; nothing is pushed.

## [2026-10-16] resume | Paused before fix round 2

State: HEAD `eb546e0` plus this docs commit; 622 tests, typecheck, lint and
build clean; nothing pushed, origin set. The three items left are in
[status.md](wiki/status.md) "Paused". A fix agent had only signed in to the
dev app when it was stopped: no source changes. To resume: fix the three,
check them in the browser, run the gates, commit, then remove the "Paused"
section.

## [2026-10-16] maintenance | Fix round 2, resumed after the pause

The three leftovers from the browser re-check are fixed and checked in the
browser: FullCalendar's first event answer now waits for the lazy
`CalendarArea` to mount (the React warning came from FullCalendar setting
state during a sliced first render); `askScope` closes its dialog before it
answers, so focus returns to Save; the phone week title shows the month
("Oct 2026") at 17 px. 623 tests. The "Paused" section is gone from
[status.md](wiki/status.md); v1 is done, waiting on the owner's steps.

## [2026-10-16] docs | README and docs/ to the readme-docs standard

The README is now a landing page: one-liner, a month-view hero, status, what
it does and what it leaves out, four screenshots, how it works, run it
locally, layout, docs, license (none yet). New in `docs/`: `README.md` (the
index), `getting-started.md` (took over owner-setup's "Local development"
section, which is now a pointer), `architecture.md`, and `images/` with
`shots.md` and `demo-seed.mjs`. The images come from a throwaway clone with a
made-up `demo` account. [status.md](wiki/status.md) caught up: `main` is
pushed, `../wzd_auth`'s `22e1fd2` too, and `../vps-deploy` has no remote.

## [2026-10-23] todo | Brief 12 filed: Base UI under the primitives

The owner asked for Base UI in the apps that still hand-build their widgets.
[Brief 12](briefs/done/12-base-ui-primitives.md) rebuilds `Dialog`, `Popover`,
`Menu` and the phone drawer on Base UI, keeping their props, and deletes
`layer.ts`. They move together because a Base UI modal traps focus away from
a hand-built popover. Native selects, checkboxes and radios stay.

## [2026-10-23] done | Brief 12: Base UI under the primitives

[Brief 12](briefs/done/12-base-ui-primitives.md) is built. `Dialog`,
`Popover`, `Menu` and the phone drawer (a modal Base UI `Dialog`) are on Base
UI with their props unchanged. `layer.ts` and the hand-written focus, key and
placement code are gone. Two fixes kept old behaviour: an Esc a control
already used no longer closes the dialog around it, and a chosen menu item
runs from `finalFocus`, so Rename's field keeps focus in the drawer. The
static-markup dialog tests mock Base UI's dialog with
`components/dialog-stub.ts`. 618 tests, typecheck, lint and build pass; before
and after screenshots at 1440 and 390 px match. The decision is in
[decisions.md](wiki/decisions.md).

## [2026-10-23] todo | Briefs 13–16 from the two open todos

[13](briefs/todo/13-sibling-repo-listings.md) fixes the stale app lists in
`../wzd_auth` (README, the OIDC runbook's redirect table) and `../shelfmark` (the obsolete
"redeploy Ward's UI" step), one commit per repo; the vps-deploy count was already right
(39 stacks). Phone notifications split into three: [14](briefs/todo/14-push-subscription-and-worker.md)
a push-only service worker, VAPID keys and stored subscriptions, copied from Satchel's
code; [15](briefs/todo/15-a-reminder-on-each-event.md) one reminder per event, off by
default, with the choices phone calendars offer; [16](briefs/todo/16-send-due-reminders.md)
a one-minute timer that sends due reminders once, expands series only over the window,
and skips anything more than 15 minutes stale after a restart. 16 replaces the "No
reminders in v1" decision when it ships.
