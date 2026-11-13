---
summary: Locked calls for Almanac, each with date, rejected alternatives and reason. React + Fastify + SQLite on Shelfmark's layout; FullCalendar v7 for day, week and month with a year view of our own; several users, each with a private calendar and no sign-up; named calendars; Base UI under the dialogs, popovers and menus, styled with Tailwind; common repeats with three edit scopes, expanded on the server; no import; one reminder per event by Web Push (since 2026-10-27, none in v1); one display time zone per user, Bucharest by default; phone browser without offline; deployed on the VPS; Google Calendar's layout, with a Light / Dark / System switch, light on a first visit; the house style, formatted and checked (Prettier at 120, vendored configs, one gate); the server grouped by feature, a schema on every route, the error body unchanged.
updated: 2026-11-13
---

# Decisions

Each entry passed three tests: hard to reverse, surprising without context, and
a real trade-off. Changing one needs an explicit revisit and a `log.md` entry.
All of these came out of the owner's grill on 2026-10-16.

## React + Fastify + SQLite, on Shelfmark's layout
_2026-10-16_. The owner chose Fastify and React. The layout, the vendored Ward
auth library and the deploy pattern come from Shelfmark (`shelfmark`):
`shared`, `server` and `web` npm workspaces, better-sqlite3, Vite. Rejected:
Postgres, which none of the estate's small apps run, and a new layout, which
would throw away a working auth and deploy setup.

_2026-11-12_, revisited. The three workspaces, better-sqlite3, Vite and the
vendored auth library are unchanged. The server no longer splits by layer
(`server/src/routes/`, `server/src/store/`) as Shelfmark's does: it is grouped
by feature (entry below), by the owner's call of 2026-11-09. The choice
itself isn't reopened.

## FullCalendar v7 draws day, week and month; the year view is our own
_2026-10-16_. FullCalendar v7 (MIT) is the only maintained React library with
all four views and drag, drop and resize free. Its year view stacks 12 full
month grids, so Almanac builds a Google-style year view of 12 mini-months,
with a dot on days that have events. Rejected: Schedule-X, whose drag and
resize became paid in v4; react-big-calendar, which has no year view;
ilamy-calendar, which has one maintainer (it also needed Tailwind, which no
longer counts against it: see below); building every view ourselves, which is
several times the work. Survey: [research.md](research.md).

_2026-11-11_, revisited. Almanac's web app is on Tailwind now (the entry
below), so the "needs Tailwind" half of the ilamy-calendar rejection no longer
applies; the choice stands on the other half (one maintainer). The choice
itself isn't reopened.

## Several users, each with a private calendar, no sign-up
_2026-10-16_. Every calendar belongs to one user and nobody else can see it.
The first user is seeded; anyone else gets in only when the owner grants them
the app in Ward, and they start with an empty calendar. There is no sign-up
page, no sharing and no invitations. Rejected: one user with no owner on rows
(Shelfmark's choice), because letting a second person in later would mean a
migration.

## Events belong to named calendars
_2026-10-16_. A user has calendars (Work, University, Gym…), each with a name,
a colour and a show/hide checkbox, like Google's left column. Every event
belongs to exactly one, and its colour comes from it. Rejected: a colour per
event with nothing to hide, because the owner collects schedules from several
places and wants to hide one at a time.

## Common repeats, three edit scopes, expanded on the server
_2026-10-16_. Repeats are daily, every weekday, weekly on chosen days, monthly
and yearly, ending never, on a date or after N times. Editing one occurrence
asks "this event", "this and following events" or "all events". The server
expands series into occurrences for the requested range with rrule-temporal.
Rejected: Google's custom-rule editor (rare and the fiddliest screen);
expanding in the browser with FullCalendar's rrule plugin, which depends on
rrule.js (no release since 2023, time-zone quirks). Model: [recurrence.md](recurrence.md).

## No import; events are typed in
_2026-10-16_. The owner creates every event by hand. Rejected: one-off `.ics`
import and subscribed ICS feeds, both offered and turned down.

## Reminders by Web Push, one per event
_2026-10-16_, v1: no reminders, to keep v1 small; Web Push (Satchel's code)
was named the first follow-up.
_2026-10-27_: each event has one reminder, none by default, from
the choices phone calendars offer (at the start, 5, 10, 15 or 30 minutes, 1 or
2 hours or a day before; an all-day event on the day or the day before at
09:00 in the user's display time zone). The API process looks once a minute
for what fell due, sends it once through Web Push to every browser the user
turned notifications on in, and drops anything more than 15 minutes late, so a
server down overnight sends no stack of stale alerts. Rejected: several
reminders per event, email, and a timer of its own per reminder; the minute
tick works from the rows as they are, so a deleted, moved or changed event
needs no clean-up. The choices are a list in `shared/src/event.ts` the owner
can change. On an iPhone it needs Almanac on the Home Screen.
_2026-10-27_, owner, after the build: `DELETE /api/push/subscriptions` answers
204 with push turned off, as Satchel's does, so a browser can always drop its
subscription; the spec's literal 404 for every push route was turned down.
`VAPID_SUBJECT` stays the `.env.example` placeholder until the owner picks an
address; production push is off anyway until the deploy passes the keys.

## One display time zone per user, Bucharest by default
_2026-10-16_. All times show in the user's chosen time zone, a setting in the
account menu that starts at Europe/Bucharest. The device's zone is ignored, so
a 10:00 meeting shows at 10:00 in London too. This is a deliberate difference
from Google, which follows the device. Rejected: following the device
(recommended, turned down), and a fixed Bucharest with no setting. Events have
no time zone of their own.

## Phone browser with a home-screen icon, no offline
_2026-10-16_. The layout works on a phone and a web manifest gives it a
home-screen icon. There is no service worker and no offline mode. Rejected:
desktop only; a full offline PWA like Shelfmark's, which would need caching and
syncing edits made offline.
_2026-10-27_: a service worker now exists for Web Push only. It has
no fetch handler and caches nothing, so there is still no offline mode.

## Deployed on the VPS like Shelfmark
_2026-10-16_. Caddy serves the app at `/almanac/` and forwards `/almanac-api/`
to the API container on port 8797, deployed by `vps-deploy`. The stack and
the Ward seed entry (`wzd_auth`) are committed locally; the owner deploys.
Rejected: local only.

## Google Calendar's layout, with a Light / Dark / System switch
_2026-10-16_. The owner asked for something that works like Google Calendar
and always light. The UI copies Google's layout straight, with no design
direction round and no dark mode. Rejected: themed directions, which the owner
turned down for showcase and Shelfmark. Layout: [features.md](features.md).

_2026-11-11_, revisited (the owner's call of 2026-11-10, Q18). The layout
stays; "light only" ends. Account menu, Theme…, offers Light, Dark and System,
and a first visit is light whatever the system says. The choice is kept on the
device (`localStorage`, beside the sidebar's preference), not on the server,
since `user_settings` holds only the time zone. The colour tokens are
`light-dark()` pairs; the dark values are a first pass in Google's dark
palette that the redesign (brief 05) refines. The calendar colours are data
and look the same in both themes, so the text on an event is fixed.

_2026-11-13_, revisited by brief 05: the look becomes Almanac's own, the calendar colours differ by theme, and the shell changes at three widths. The old lines are kept as history in [redesign.md](redesign.md).

## Base UI under the dialogs, popovers, menus and drawer
_2026-10-23_, the owner's call, to match their other apps (atrium,
imbatranimOS, sports-app, trips and others). `Dialog`, `Popover`, `Menu` and
the phone drawer sit on `@base-ui/react` (pinned 1.9.0), styled by Almanac's
own CSS; their props didn't change ([overlays.md](overlays.md)).
Base UI owns focus, keys, placement and nesting, which `layer.ts` and the
hand-written key handling did before. It costs about 50 kB gzip on the main
chunk. Native selects, checkboxes and radios stay native, and so does the
time field's list. Rejected: keeping the hand-built components, and shadcn,
which brings Tailwind, which Almanac doesn't use.

_2026-11-11_, revisited. The wrappers are styled with Tailwind now, by the
owner's call of 2026-11-09 (whole apps move to Tailwind v4, Almanac's web app
included: one stylesheet, `web/src/styles/index.css`, and utilities on the
markup). Both halves of the old entry change: "styled by Almanac's own CSS"
and "Tailwind, which Almanac doesn't use". shadcn stays rejected, for a reason
of its own: Base UI is used directly, without a styled kit on top.

_2026-11-11_, the base-ui skill's conventions (the owner's grilling of
2026-11-10): Base UI is imported only under `web/src/components/ui/`, and the
widgets Almanac had built by hand moved onto it: the toast (`Toast`), the
delete-calendar confirm (`AlertDialog`), the time zone list (`RadioGroup`), the
weekday toggles and the colour palette (`ToggleGroup`, guarded for the
palette because it saves on each choice), and the notifications switch. The
phone drawer is Base UI's `Drawer` (Q40), closed by a swipe too; it replaces
the "a side panel without swipe is a positioned Dialog" call above. No
`SwipeArea`, which would fight the swipe on the view. Native text, date and
time inputs and selects stay native (Q16). `Button` and tooltips stay as
they were (decision 4 of the brief). Styling moved to Tailwind afterwards (above).

## The house style, formatted and checked
_2026-11-11_, the owner's grilling of 2026-11-10. Almanac holds a copy of the
skills library's `house-style` folder in `vendor/house-style/` (version
header inside, refreshed by `npm run house-style:sync`, never edited), and its
configs extend it: Prettier at width 120 with trailing commas, double quotes
and semicolons; a thin ESLint config with six typed rules; knip and
dependency-cruiser presets; `npm run check` as the gate and `check:fast` as
its subset. The reformat is one commit, listed in `.git-blame-ignore-revs`.
Markdown stays out of Prettier. `tsconfig.base.json` carries the house flags
itself instead of extending the copy, because the image build copies only
that file before `tsc -b server`. Rejected: width 130, which churns the least
(333 lines against 502) but gives the estate two widths; a git or tarball
dependency, which needs `git` in the Docker `deps` stage; and committing
hooks to `.claude/settings.json`, since the plugin carries them. Two rules
started softer: `n/no-process-env` and dependency-cruiser's `no-circular` were
warnings until the server took its settings from `config.ts` and each feature
had its own options type (both are errors since 2026-11-12), and the two
convention checkers ran `--warn-only` until the Base UI, Tailwind and server
layout work landed (both strict since 2026-11-12).

## The server in the house code structure
_2026-11-12_, the owner's call of 2026-11-09, grilled 2026-11-10; the
`code-structure` skill. `server/src/` has `server.ts` (the only file that
listens: settings, `buildApp`, `close-with-grace`, then `listen`), `app.ts`
(`buildApp(config, options)`, which never listens), `config.ts` (the only
reader of the environment, and of the `.env` file and the data folder),
`plugins/` (errors, the JSON body, sign-in: each wrapped in `fastify-plugin`,
registered in that order, errors first), `features/<name>/` (health,
calendars, events, occurrences, search, settings, push, reminders: each with an
`index.ts`, its own options type, its routes and its store, and used by others
through the index only), `lib/` (the `ApiError` class, `idParamsSchema`, the
env-file helper; no Fastify import) and `db/`. Every route declares its
params, querystring and body, and a `response` for each status it sends,
through `@fastify/type-provider-zod`: a field a schema doesn't name never
leaves the server. The error body stays `{ error: { code, message } }`, which
`web/src/api.ts` parses; a reply that fails its schema is a 500 `internal`
with a fixed message, logged with the method and URL. `occurrenceSchema`
uses `storedRepeatSchema` (no `.transform()`), because zod throws when it
encodes through one; the input schemas keep the sorting `repeatSchema`.
`check-structure` and every dependency-cruiser rule are strict. The process
sets `trustProxy` (loopback plus `AUTH_TRUSTED_PROXIES`), `connectionTimeout`
10 s, `requestTimeout` 30 s and `keepAliveTimeout` 125 s (above Caddy's
two-minute idle keep-alive); these are defaults, still open for the owner.
Rejected: Shelfmark's layer split (a feature's change should stay in one
folder), `@fastify/autoload` (the registration order is the architecture, and
a feature registered by name is found with grep), and TypeBox (the shared
schemas are zod and the web imports them). The before-and-after JSON comparison is in
[log.md](../log.md).
