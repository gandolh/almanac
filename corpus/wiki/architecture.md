---
summary: How Almanac will be put together, planned 2026-10-16 before any code. Shelfmark's three workspaces (shared, server, web), what each owns, the planned API routes, request paths behind Caddy, dev and production ports (API 8809, Vite 5177, VPS 8797), where data lives, and secrets.
updated: 2026-10-16
---

# Architecture

Planned, not built. The code wins once it exists.

## Pieces

npm workspaces on Shelfmark's layout (`../shelfmark`), Node 24, exact versions,
TypeScript strict, Vitest, ESLint:

- `shared`: zod schemas for every route, the repeat presets and their RRULEs,
  date helpers both sides use.
- `server`: Fastify + better-sqlite3. The store (the only module that runs
  SQL, apart from the vendored auth library), occurrence expansion with
  rrule-temporal ([recurrence.md](recurrence.md)), search, and the `/api/*`
  and `/auth/*` routes. The Ward auth library is vendored the way Shelfmark
  does it (`../shelfmark/server/vendor/ward`).
- `web`: Vite + React. FullCalendar v7 (`daygrid`, `timegrid`, `interaction`)
  for day, week and month; our own year view; plain CSS with tokens, light
  only. A web manifest for the home-screen icon, no service worker.

## Planned routes

| Route | Does |
|---|---|
| `GET /api/calendars`, `POST`, `PATCH /:id`, `DELETE /:id` | the user's calendars |
| `GET /api/occurrences?from&to` | one-off events and expanded series in range |
| `POST /api/events`, `PATCH /api/events/:id`, `DELETE /api/events/:id` | create, edit, delete, with an edit scope for series |
| `GET /api/search?q` | the user's events matching title, location or notes |
| `GET`, `PATCH /api/settings` | display time zone |
| `/auth/*` | the vendored Ward auth plugin: local login and Sign in with Ward |

Every query is scoped to the signed-in user.

## Request paths

As Shelfmark: Caddy on the VPS serves the web app at `/almanac/*` and forwards
`/almanac-api/*` with `handle_path` to the API container on
`127.0.0.1:8797`, deployed by `../vps-deploy`. In dev, Vite proxies
`/almanac-api` to the API and strips the prefix, so paths match production.
The Ward callback is `<origin>/almanac-api/auth/ward/callback`, registered by
the local seed in `../wzd_auth`.

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

`data/almanac.db` in dev, a bind-mounted volume in the container.

## Secrets

`.env` (gitignored) holds the seed user values and the `WARD_OIDC_*` values the
Ward seed writes. `.env.example` lists the keys with no values.
