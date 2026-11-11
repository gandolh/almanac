# Log

## [2026-10-16] maintenance | Corpus bootstrapped

New repo, local git on `main`, no remote (the owner
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
`unauthorized`. See brief 01.

## [2026-10-16] done | Brief 02: accounts and sign-in

Ward auth plugin registered first, origin guard, `currentUserId` in
`auth/guard.ts`, seed, multi-user test helpers (`signInAs`), and the web
login, auth gate and change-password dialog copied from Shelfmark with a
Google-like light palette. See brief 02.

## [2026-10-16] done | Brief 03: calendars, events and settings API

Migration 1, the calendar, event and settings stores, and every route shape,
with repeats refused until brief 04. Per-user scoping with 404 for other
users' ids. New wiki page [data-model.md](wiki/data-model.md). See
brief 03.

## [2026-10-16] done | Brief 04: repeating events

Repeat presets as RRULEs, server-side expansion with rrule-temporal in the
series' zone, and the three edit scopes for edit and delete. The as-built
rules are in [recurrence.md](wiki/recurrence.md). See
brief 04.

## [2026-10-16] done | Brief 05: app shell, routes, dates and tokens

Google-style top bar, sidebar with mini-month, drawer on phones, view routes
`/<view>/y/m/d`, `dates.ts` on Temporal, calendar and settings data hooks,
shortcuts and commands, Popover, Dialog, Toast, MonthGrid, the home-screen
icon, and stubs for briefs 06-10. `.gitignore` fixed so `web/src/data/` is
tracked. See brief 05.

## [2026-10-16] done | Brief 06: day, week and month views

FullCalendar v7 with the Monarch theme on our tokens, the occurrences data
layer, the details popover, linkify, the edit-scope dialog, drag, drop and
resize. See brief 06.

## [2026-10-16] done | Brief 08: year view

Twelve mini-months with dots on days that have events, a day list in a
popover, links to the day and month. See brief 08.

## [2026-10-16] done | Brief 11: container, VPS stack, Ward entry, owner docs

Dockerfile and compose (port 8797), the vps-deploy stack (`8e247a3`) and the
local Ward seed entry (`22e1fd2`), both unpushed, `docs/owner-setup.md` and
the README. See brief 11.

## [2026-10-16] done | Brief 10: search

Top-bar search field, `/` to focus, results grouped by date, a click opens
the day. See brief 10.

## [2026-10-16] done | Brief 09: managing calendars, and the time zone setting

"My calendars" with show/hide, rename, colour and delete, a new-calendar
dialog, and the time zone dialog in the account menu. See
brief 09.

## [2026-10-16] done | Brief 07: creating and editing events

Quick create, the event form, the repeat picker, the 24-hour time field, `c`
to create, scope questions on series edits. See
brief 07.

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
remote `<owner>/almanac` was added; nothing is pushed.

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
pushed, `wzd_auth`'s `22e1fd2` too, and `vps-deploy` has no remote.

## [2026-10-23] todo | Brief 12 filed: Base UI under the primitives

The owner asked for Base UI in the apps that still hand-build their widgets.
Brief 12 rebuilds `Dialog`, `Popover`,
`Menu` and the phone drawer on Base UI, keeping their props, and deletes
`layer.ts`. They move together because a Base UI modal traps focus away from
a hand-built popover. Native selects, checkboxes and radios stay.

## [2026-10-23] done | Brief 12: Base UI under the primitives

Brief 12 is built. `Dialog`,
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

Brief 13 fixes the stale app lists in
`wzd_auth` (README, the OIDC runbook's redirect table) and `shelfmark` (the obsolete
"redeploy Ward's UI" step), one commit per repo; the vps-deploy count was already right
(39 stacks). Phone notifications split into three: 14
a push-only service worker, VAPID keys and stored subscriptions, copied from Satchel's
code; 15 one reminder per event, off by
default, with the choices phone calendars offer; 16
a one-minute timer that sends due reminders once, expands series only over the window,
and skips anything more than 15 minutes stale after a restart. 16 replaces the "No
reminders in v1" decision when it ships.

## [2026-10-27] done | Brief 14: the push worker and the subscriptions

Brief 14 is built. The
server takes three `VAPID_*` settings (all or none) and stores each browser's
subscription in `push_subscriptions`. The routes are `/api/push/key`,
`/api/push/subscriptions` (PUT, DELETE) and `/api/push/test`. With push off,
DELETE still works and the rest are 404. `sendToUser` deletes a subscription
the push service says is gone; brief 16 sends through it. The worker is a
plain `web/public/sw.js`: push and notification presses only, nothing cached.
The account menu has a Notifications dialog, and `npm run vapid-keys` writes
a pair into `.env`. 694 tests. The worker and the dialog's states were checked
in headless Chromium; no real push reached a browser or a phone. The
"no service worker" line in [decisions.md](wiki/decisions.md) now says the
worker is push-only. Production needs the `VAPID_*` values passed by
`vps-deploy`'s Almanac stack, an owner step.

## [2026-10-27] done | Brief 15: a reminder on each event

Brief 15 is built. Each event has
one `reminderMinutes`, none by default, from the choices phone calendars offer
(`TIMED_REMINDERS`, `ALL_DAY_REMINDERS` in `shared/src/event.ts`), stored in
`events.reminder_minutes` (migration 3). Anything else is a 400, and switching
an event between timed and all-day resets it. The edit scopes carry it like
the title. The event form has a Reminder select under the times, and the
details popover shows it. 714 tests; the form and the details were checked in
headless Chromium. Nothing is sent yet. [data-model.md](wiki/data-model.md)
caught up with migrations 2 and 3 (brief 14 had left it out), and
[glossary.md](wiki/glossary.md) has **Reminder**.

## [2026-10-27] done | Brief 16: send due reminders

Brief 16 is built. `server/src/reminders/`
runs a tick a minute in the API process while push is on (`REMINDER_TIMER`
turns it off). Each tick finds the reminders due since the last one, at most 15
minutes back, from the events store with series expanded over a day's
lookahead. All-day ones are worked out on the wall clock in the user's zone.
Each is claimed in `reminders_sent` (migration 4) before it is sent, so it goes
once. 745 tests with a fake clock. Live, the built server sent a real Web Push
to FCM in the tick after an event's "at the start" reminder fell due; no
phone was tried. The decision "No reminders in v1" in
[decisions.md](wiki/decisions.md) is replaced by "Reminders by Web Push, one
per event", and [overview.md](wiki/overview.md), [features.md](wiki/features.md)
and [architecture.md](wiki/architecture.md) caught up.

## [2026-10-27] done | Brief 13: the app lists in sibling repos

Brief 13 is built, once the agent
working in `wzd_auth` had finished. Its facts still held after Ward's briefs
34-38. In `wzd_auth` (`39ec172`), the README names shelfmark among the apps
with "Sign in with Ward" and almanac as registered for local development, the
screenshot's alt text drops its count, and the cutover table has rows for
shelfmark and almanac read from their server configs. In `shelfmark`
(`4d48bd4`), the obsolete "Redeploy Ward's UI" owner step is gone. Both are
local commits, not pushed. Flagged, not changed: Ward's console screenshot is
from 2026-10-09, its README still calls the move to its own host pending, and
the cutover table's satchel row predates Satchel's own host.

## [2026-10-27] decision | Push: DELETE stays 204, VAPID_SUBJECT stays a placeholder

The owner answered two questions from briefs 14-16. `DELETE
/api/push/subscriptions` keeps answering 204 with push off, as Satchel's does,
rather than brief 14's literal 404. `VAPID_SUBJECT` stays the placeholder until
the owner picks an address; production push needs the deploy to pass the keys
first (`docs/owner-setup.md` step 8). Recorded in
[decisions.md](wiki/decisions.md). The comment in `web/index.html` that said "no
service worker" now says the worker is for Web Push only.

## [2026-10-31] maintenance | README images retaken; the README names reminders

A README refresh pass with the readme-docs standard. The README still said version 1 has no reminders and that they were the first planned addition, though briefs 14-16 built them on 2026-10-27. It now lists push reminders in What it does and says they need the server's VAPID keys. All five images were taken again with `docs/images/demo-seed.mjs` on a scratch `DATA_DIR`: the event form now shows its bell field, set to 30 minutes before for the picture and not saved, and the overlays sit on Base UI since brief 12. `shots.md` records the Playwright capture. Checked: `npm ci`, the seed, `npm run dev` on port 5177 and the demo seed.

## [2026-11-01] maintenance | Briefs reset

Part of an estate-wide reset. The sixteen briefs in `briefs/done/` are folded
into the wiki and deleted, and the two promoted todos with them; brief
numbering restarts at 01. The old briefs read like the grilling that fed the
first corpus. The last commit that held them is `6327b86`: read one with
`git show 6327b86:corpus/briefs/done/04-repeating-events.md`. Brief numbers
in the entries above refer to that set.

New pages: [notifications.md](wiki/notifications.md) (briefs 14-16),
[overlays.md](wiki/overlays.md) (brief 12) and [web-app.md](wiki/web-app.md)
(the web side of briefs 05-10). [architecture.md](wiki/architecture.md) gained
the session gating and two workspace gotchas,
[recurrence.md](wiki/recurrence.md) the "following" on the first occurrence
rule, and the other pages lost their brief citations.
[status.md](wiki/status.md) is a per-area snapshot instead of a brief table,
and gained the open bug that the phone search field leaves the top bar's
buttons in tab order. Code comments no longer cite brief numbers.

## [2026-11-09] todo | Briefs 01-04: house style, Base UI conventions, Tailwind, server structure

The owner's calls of 2026-11-09 for every web app (Base UI 1.9.0 everywhere,
whole apps on Tailwind v4, the researched conventions enforced in each repo)
are filed as four briefs, in run order. 01 adopts the house style and the
quality harness: Prettier at Almanac's least-churn width (130: 333 lines in
70 files), `verbatimModuleSyntax` and `erasableSyntaxOnly` (one error, the
parameter property in `server/src/errors.ts`), the typed lint rules, `npm run
check` and `check:fast`, `.claude/rules/`, and a root `CLAUDE.md`. 02 brings
Base UI to the base-ui skill's rules: five imports outside a `ui/` folder,
the drawer without a title or `initialFocus`, and five hand-built widgets
(toast, two radio groups, the weekday toggles, the delete confirm). 03 moves
the fourteen stylesheets (3,412 lines) to Tailwind, with FullCalendar's CSS in
a cascade layer so its overrides can be utilities. 04 puts the server in
feature folders with zod route and response schemas; `occurrenceSchema`'s
`repeat.byDay` transform makes zod's encode throw, so the output needs a
transform-free shape first. No bump brief: `@base-ui/react` is pinned at
1.9.0 and the lockfile resolves it. Corrections to the skills library's
Almanac draft: 117 tokens in `tokens.css`, not 159; no dark selector is live.
`.planned-roots` gained `.claude` and `scripts`.

## [2026-11-10] revise | Briefs 01-05 follow the owner's grilling

The owner's answers and the technical calls of 2026-11-10 are folded into the
briefs. 01: `house-style` is vendored (a copy with a version header and a
`house-style:sync` script), so no git dependency and no Dockerfile change;
Prettier width 120 (502 lines in 93 files, from the table already measured)
instead of 130; `!` is a warning in tests; `considerDefaultExhaustiveForUnions`
on. 02: the phone drawer moves to Base UI's `Drawer` with a swipe to close
(Q40); the colour palette becomes a guarded `ToggleGroup`, so no
`ColorPicker` exception; form dialogs keep `disablePointerDismissal` (Q58);
parity is "close enough" (Q19). 03: a Light / Dark / System switch, light on a
first visit, `dark:` off `data-theme`, kept in `localStorage` beside the
sidebar's key (Q18); FullCalendar's CSS stays in the lazy chunk in its own
stylesheet (Q42); the 15 px root moves onto `body` (Q44); tests select by role
(Q62). 04: the entry rename changes the Dockerfile's `CMD` and needs no
vps-deploy edit (Q1); the error handler keeps Almanac's body (Q43);
`healthSchema` and `idParamsSchema` live server-side (Q55). New brief 05, a
redesign with Hallmark on the estate board (Q39). No measurement changed.

## [2026-11-11] build | Brief 01: the house style and its harness

Built on `main`. Vendored `house-style` 1.0.0 in `vendor/house-style/` with
`house-style:sync`; the twelve tool pins (exact); Prettier at 120 and one
reformat commit (90 files, listed in `.git-blame-ignore-revs`; the esbuild
bundle compare matched for every TypeScript and JavaScript file, and the only
CSS difference is hex case in `tokens.css`); `verbatimModuleSyntax` and
`erasableSyntaxOnly` (one error, `ApiError`'s parameter property; zero for
imports); the house ESLint config; `npm run check`, `check:fast` and
`check:conventions`; a root `CLAUDE.md` and `.claude/rules/`.

Measured before turning rules on (per rule, source and tests): no-floating-
promises 1 (`void` on Fastify's default parser call), no-misused-promises 0,
await-thenable 0, switch-exhaustiveness-check 0, no-unnecessary-type-assertion
2 + 11 (the 11 are `res.json() as T` in tests, now `res.json<T>()`),
consistent-type-imports 0, no-non-null-assertion 9 (all in
`reminders.test.ts`, fixed), no-redeclare 3 (a redundant `/* global */`
comment in `docs/images/demo-seed.mjs`, removed), vitest `expect-expect` 5
without `assertFunctionNames` and 0 with `expectError` named,
`n/no-process-env` 4 (a warning). Nothing passed 20, so nothing went to the
owner. Lint time with `projectService` 18.9-23.7 s against `project: true`
15.1-17.3 s on a first pair of runs, and 15.7 / 16.9 against 16.3 / 15.1
interleaved: a draw, so `projectService` stays. knip with the preset: 0
unused files, 0 unused dependencies once `@vite-pwa/assets-generator` (run by
hand for the icons, named by no script) is listed in `ignoreDependencies`;
22 unused exports and 10 unused types, as warnings.
dependency-cruiser: 7 `no-circular` errors (the route files import
`FeatureContext` from `app.ts`), lowered to a warning by name. Checkers, left
`--warn-only`: `check-base-ui` 19 (rule-3 5, rule-5 14), `check-structure` 31
errors (rule-3 4, rule-6 26, rule-1 1) and 7 warnings (rule-11).
Timings, warm: `check:fast` 4.9-5.6 s with one server file changed, 12 s with
one web file, 3 s with none; `npm run check` 41.8 s.

## [2026-11-11] build | Brief 02: Base UI by the conventions

Built on `main`. Every Base UI import is under `web/src/components/ui/`: `Dialog`,
`Menu` and `Popover` moved there, and `Drawer` (Base UI's, swipe left closes it),
`Switch`, `Toast` (a module-level manager, `showToast` unchanged), `ConfirmDialog`
(`AlertDialog`, shut while its action runs), `RadioGroup` (the time zone list,
with Home and End added), and `ToggleGroup` (the weekday toggles, and the guarded
palette) were added. `check-base-ui` went 19 to 14 errors, all rule 5 (brief 03);
rules 1-4, 6, 7 and 9-11 are 0. jsdom and Testing Library were added as root
devDependencies for the wrapper tests (745 to 771 tests). Before and after
screenshots at 1280 and 390 px show no change. See the brief's outcome note.

## [2026-11-11] build | Brief 03: the web app to Tailwind

Built on `main`, one commit per step. All fourteen stylesheets are gone; the app
has `web/src/styles/index.css` (the layer order, `@theme` with the 117 tokens in
Tailwind's namespaces, the page's base rules) and `web/src/calendar/fullcalendar.css`
(FullCalendar's two sheets in a `fullcalendar` layer under `components` and
`utilities`, and the Monarch palette). Tailwind 4.3.5, `@tailwindcss/vite`,
`clsx`, `tailwind-merge` 3.7.0. The 15 px root moved to `body`. FullCalendar is
styled through its class-name options; the markers `cal-mirror` and
`cal-highlight` stay. Repeated looks are class strings in
`web/src/components/looks.ts` and `web/src/event/looks.ts`. `better-tailwindcss`
is on, class order included; `check-base-ui` is strict with two exceptions in
`scripts/conventions.json`. A Light / Dark / System switch (account menu,
Theme…) was added, light on a first visit, kept in `localStorage`, set before
the first paint by a script in `web/index.html`. Revisited in
[wiki/decisions.md](wiki/decisions.md): "Base UI under the dialogs, popovers,
menus and drawer", "FullCalendar v7 draws day, week and month; the year view is
our own" (the Tailwind half no longer applies), and "Google Calendar's layout,
light only", now "…with a Light / Dark / System switch". Light screenshots at
1280, 390 and 1024 px match the old ones but for the clock and the hover state a
tap no longer leaves; built CSS 45.3 kB (8.6 gzip) to 57.2 kB (11.1 gzip) main,
20.6 kB (4.5 gzip) to 19.3 kB (4.1 gzip) for the calendar's sheet.
