---
summary: Locked calls for Almanac, each with date, rejected alternatives and reason. React + Fastify + SQLite on Shelfmark's layout; FullCalendar v7 for day, week and month with a year view of our own; several users, each with a private calendar and no sign-up; named calendars; Base UI under the dialogs, popovers and menus; common repeats with three edit scopes, expanded on the server; no import; one reminder per event by Web Push (since 2026-10-27, none in v1); one display time zone per user, Bucharest by default; phone browser without offline; deployed on the VPS; Google Calendar's layout, light only.
updated: 2026-10-27
---

# Decisions

Each entry passed three tests: hard to reverse, surprising without context, and
a real trade-off. Changing one needs an explicit revisit and a `log.md` entry.
All of these came out of the owner's grill on 2026-10-16.

## React + Fastify + SQLite, on Shelfmark's layout
_2026-10-16_. The owner chose Fastify and React. The layout, the vendored Ward
auth library and the deploy pattern come from Shelfmark (`../shelfmark`):
`shared`, `server` and `web` npm workspaces, better-sqlite3, Vite. Rejected:
Postgres, which none of the estate's small apps run, and a new layout, which
would throw away a working auth and deploy setup.

## FullCalendar v7 draws day, week and month; the year view is our own
_2026-10-16_. FullCalendar v7 (MIT) is the only maintained React library with
all four views and drag, drop and resize free. Its year view stacks 12 full
month grids, so Almanac builds a Google-style year view of 12 mini-months,
with a dot on days that have events. Rejected: Schedule-X, whose drag and
resize became paid in v4; react-big-calendar, which has no year view;
ilamy-calendar, which needs Tailwind and has one maintainer; building every
view ourselves, which is several times the work. Survey: [research.md](research.md).

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
_2026-10-27_, briefs 14-16: each event has one reminder, none by default, from
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
_2026-10-27_, brief 14: a service worker now exists for Web Push only. It has
no fetch handler and caches nothing, so there is still no offline mode.

## Deployed on the VPS like Shelfmark
_2026-10-16_. Caddy serves the app at `/almanac/` and forwards `/almanac-api/`
to the API container on port 8797, deployed by `../vps-deploy`. The stack and
the Ward seed entry (`../wzd_auth`) are committed locally; the owner deploys.
Rejected: local only.

## Google Calendar's layout, light only
_2026-10-16_. The owner asked for something that works like Google Calendar
and always light. The UI copies Google's layout straight, with no design
direction round and no dark mode. Rejected: themed directions, which the owner
turned down for showcase and Shelfmark. Layout: [features.md](features.md).

## Base UI under the dialogs, popovers, menus and drawer
_2026-10-23_, the owner's call, to match their other apps (atrium,
imbatranimOS, sports-app, trips and others). `Dialog`, `Popover`, `Menu` and
the phone drawer sit on `@base-ui/react` (pinned 1.9.0), styled by Almanac's
own CSS; their props didn't change ([brief 12](../briefs/done/12-base-ui-primitives.md)).
Base UI owns focus, keys, placement and nesting, which `layer.ts` and the
hand-written key handling did before. It costs about 50 kB gzip on the main
chunk. Native selects, checkboxes and radios stay native, and so does the
time field's list. Rejected: keeping the hand-built components, and shadcn,
which brings Tailwind, which Almanac doesn't use.
