---
summary: How Almanac is put together, built on 2026-10-16. Shelfmark's three workspaces (shared, server, web), what each owns, the API routes, request paths behind Caddy, dev and production ports (API 8809, Vite 5177, VPS 8797), time zones on both sides, where data lives, where the reminder timer runs, and secrets.
updated: 2026-11-01
---

# Architecture

Built on 2026-10-16. The code wins where this page and it disagree.

## Pieces

npm workspaces on Shelfmark's layout (`shelfmark`), Node 24, exact versions,
TypeScript strict, Vitest, ESLint:

- `shared`: zod schemas for every route, the repeat presets and their RRULEs,
  date helpers both sides use.
- `server`: Fastify + better-sqlite3. The store (the only module that runs
  SQL, apart from the vendored auth library), occurrence expansion with
  rrule-temporal ([recurrence.md](recurrence.md)), search, and the `/api/*`
  and `/auth/*` routes. The Ward auth library is vendored the way Shelfmark
  does it (`shelfmark/server/vendor/ward`).
- `web`: Vite + React. FullCalendar v7 (`daygrid`, `timegrid`, `interaction`)
  for day, week and month; our own year view; plain CSS with tokens, light
  only. A web manifest for the home-screen icon, and since 2026-10-27 a
  push-only service worker, `web/public/sw.js`, that caches nothing. How the
  web app is wired: [web-app.md](web-app.md).

## Routes

| Route | Does |
|---|---|
| `GET /api/calendars`, `POST`, `PATCH /:id`, `DELETE /:id` | the user's calendars |
| `GET /api/occurrences?from&to` | one-off events and expanded series in range |
| `POST /api/events`, `PATCH /api/events/:id`, `DELETE /api/events/:id` | create, edit, delete, with an edit scope for series |
| `GET /api/search?q` | the user's events matching title, location or notes |
| `GET`, `PATCH /api/settings` | display time zone |
| `GET /api/push/key`, `PUT`, `DELETE /api/push/subscriptions`, `POST /api/push/test` | Web Push: the server's key, this browser's subscription, a test notification ([notifications.md](notifications.md)) |
| `/auth/*` | the vendored Ward auth plugin: local login and Sign in with Ward |

Every query is scoped to the signed-in user. Every route but `GET
/api/health` needs a session: the Ward plugin's root `onRequest` hook answers
`401 unauthorized` first, so an unknown path without a session is a 401, not
a 404. `server/src/auth/guard.ts` adds a 403 for a write sent from another
origin (the `SameSite=Lax` cookie would still ride along from a sibling
subdomain), and routes read the user with `currentUserId(request)`.

## Request paths

As Shelfmark: Caddy on the VPS serves the web app at `/almanac/*` and forwards
`/almanac-api/*` with `handle_path` to the API container on
`127.0.0.1:8797`, deployed by `vps-deploy`. In dev, Vite proxies
`/almanac-api` to the API and strips the prefix, so paths match production.
The Ward callback is `<origin>/almanac-api/auth/ward/callback`, registered by
the local seed in `wzd_auth`.

## Time zones

Checked 2026-10-16. FullCalendar v7 (`@fullcalendar/react` 7.1.3) takes a
named zone directly (`timeZone: 'Europe/Bucharest'`) with no Luxon or
moment-timezone plugin; `temporal-polyfill` is its peer dependency. The API
sends instants as UTC ISO strings (`…Z`) and FullCalendar shifts them into the
display time zone. Dates FullCalendar hands back in callbacks are real
instants; convert them with
`info.date.toTemporalInstant().toZonedDateTimeISO(zone)` when wall-clock
fields are needed. Node 24 has no global `Temporal`, so the server imports
`temporal-polyfill` too, and rrule-temporal takes its `ZonedDateTime`s.

## Ports

Dev: API `8809`, Vite `5177`. Production: API container on `127.0.0.1:8797`.
All three were free in the estate on 2026-10-16 (8797 appears only in Ward's
own test fixtures).

## Data

`data/almanac.db` in dev, a bind-mounted volume in the container. The root
`.gitignore` ignores `data/`, which would also hide `web/src/data/`, so it
re-includes that folder with `!web/src/data/`.

## Workspace gotchas

- The root `pretest` runs `tsc -b shared`: server and web tests import the
  shared package's built output.

## Reminders

Since 2026-10-27 a tick a minute inside the API process sends due reminders
(`server/src/reminders/`), started by `buildApp` while push is on and
`REMINDER_TIMER` isn't `off`. One process sends; a second on the same database
sets `REMINDER_TIMER=off`. How it works: [notifications.md](notifications.md).

## Secrets

`.env` (gitignored) holds the seed user values, the `WARD_OIDC_*` values the
Ward seed writes, and the `VAPID_*` push keys `npm run vapid-keys` writes.
`.env.example` lists the keys with no values.
