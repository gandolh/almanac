# Task 06: Almanac's events on the phone's calendar

**Depends on:**

- In Almanac: [brief 04](../done/04-the-server-in-the-code-structure.md), for `server/src/features/`, the type provider and the error plugin; [brief 05](../done/05-a-redesign-with-hallmark-on-the-estate-board.md), for the account menu's current look and the Playwright fixtures in `web/e2e/`.
- The todo [Almanac's events on the phone's calendar](../../todos/almanac-events-on-the-phone-calendar.md) (2026-11-13), and its four questions.
- The owner's answer 5 of the backlog grill of 2026-11-13 ("go with recommended"): **now**, as a read-only private `.ics` feed of all the user's calendars, alarms stripped, Web Push staying the one reminder.
- In the owner's skills library: the `code-structure` skill (rules 4-9, the `@fastify/rate-limit` pin, the string-reply note in `zod-type-provider.md`) and the `base-ui` skill (rules 11, 12, 17).

**Runs after:** 01 to 05. **Runs before:** nothing.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The owner wants Almanac's events in the phone's own calendar app without opening Almanac. Nextcloud gets there with CalDAV. Almanac gets there with a feed: one private `.ics` link per user that a calendar app subscribes to (ICSx⁵ on Android, Google Calendar's "From URL", Apple's "Subscribed calendar"). Edits still happen in Almanac; the phone shows them after its next refresh.

This is the other direction from [No import; events are typed in](../../wiki/decisions.md) (2026-10-16). Sending events out doesn't reopen import.

### What the feed has to carry (read 2026-11-13)

| Row kind (`events`) | In the feed |
|---|---|
| One-off, timed (`start_at`, `end_at`, UTC ms) | A `VEVENT` with `DTSTART` and `DTEND` in UTC (`20261016T070000Z`). |
| One-off, all-day (`start_date`, `end_date`, end exclusive) | `DTSTART;VALUE=DATE` and `DTEND;VALUE=DATE`; the stored end is already RFC 5545's exclusive end. |
| Series, timed (`rrule`, `tzid`) | `DTSTART;TZID=<tzid>` and `DTEND;TZID=<tzid>` as the first occurrence's wall-clock times in the row's `tzid`, then `RRULE:` and the stored rule. The stored `UNTIL` is already a UTC date-time (`shared/src/repeat.ts`). |
| Series, all-day | `VALUE=DATE` times, `RRULE:` and the stored rule (`UNTIL` is a date). |
| A series' `exdates` (occurrence keys) | `EXDATE` in the same form as the series' `DTSTART`: `TZID` and wall-clock time, or `VALUE=DATE`. |
| Exception (`series_id`, `original_start`) | Its own `VEVENT` with the series' `UID` and a `RECURRENCE-ID` in the series' `DTSTART` form; its own times as a one-off's. Its key is not also an `EXDATE`. |
| `reminder_minutes` | Nothing. No `VALARM`, ever. |

Every series' zone gets a `VTIMEZONE` (RFC 5545 asks for one per `TZID`), and the user's display time zone gets one too, so a feed with no events still holds a component.

## Owner decisions

All dated 2026-11-13. 1-4 are the owner's (answer 5, "go with recommended" on the todo's questions); 5-12 are technical calls made writing this brief, which the owner may overrule.

1. **A read-only feed, not CalDAV.** Rejected: CalDAV, which would make Almanac a CalDAV server (two-way sync, conflict handling, scheduling), far bigger work for an edit the owner can make in Almanac.
2. **All of the user's calendars, in one feed**, the hidden ones too. Rejected: only the ticked ones, because hiding a calendar is a way to tidy the web view, and it would empty the phone's copy as a side effect.
3. **No alarms.** The feed never writes a `VALARM`; an event's reminder stays Web Push's. Rejected: alarms in the feed (two alerts for one reminder) and dropping Web Push.
4. **The phone's refresh is the calendar app's.** ICSx⁵ refreshes on the interval the owner sets in it (the feed hints one hour with `REFRESH-INTERVAL` and `X-PUBLISHED-TTL`). An edit reaches the phone at its next refresh; that delay is accepted.
5. **The secret is in the URL.** A calendar app subscribes with a URL and can't do Almanac's cookie sign-in; Google Calendar's "From URL" can't send a password either. A secret link is what Google Calendar's own "secret address in iCal format" does. The token is 32 bytes from `crypto.randomBytes` (256 bits), base64url. Rejected: HTTP Basic (Google can't send it, and it would need a second password per user), a session cookie (calendar apps have none).
6. **The token is stored hashed and shown once.** The database keeps the SHA-256 of the token, never the token; a request is looked up by the hash of what it presents and the stored hash compared with `timingSafeEqual`, as the sign-in library treats session tokens. So Almanac can show the link only when it makes it: on turning the feed on and on "New link". After that the dialog says the feed is on and since when. Rejected: keeping the token readable, which would put every user's link in a copy of the database.
7. **One link per user; a new link kills the old one.** A table with the user as primary key; no row is the off state. "New link" replaces the hash in one statement, so the old link is a 404 from that moment. Turning the feed off deletes the row. Deleting the user deletes it (cascade). Changing the password doesn't touch it (Google's secret address works the same way).
8. **The route.** `GET /api/feed/:token/almanac.ics`, public to the sign-in library (`PUBLIC_ROUTES`), never reading the session; `HEAD` comes with it. The static last segment keeps the router from splitting the token, and gives calendar apps a file name. The `params` schema is a plain string: a malformed, unknown, replaced or deleted token answers one identical `404 not_found`, "There is no such route.", the not-found handler's own words. A token longer than the router's 100-character parameter limit misses the route and gets the sign-in library's 401; accepted, since no real link is that long.
9. **Rate limits.** `@fastify/rate-limit` 11.2.2 (the code-structure skill's pin), registered `global: false`: the feed route at 30 requests a minute per address, and the 404 handler at 60 (the skill's rule 8). The key is `request.ip`, which is the client only when `AUTH_TRUSTED_PROXIES` names the proxy's network in the container; otherwise every client shares one bucket, and 30 a minute still covers a few phones polling hourly. A 429 answers the new `rate_limited` code.
10. **Caching.** `Cache-Control: private, no-cache`, a strong `ETag` over the body, and `304` for a matching `If-None-Match`. `DTSTAMP`, `CREATED` and `LAST-MODIFIED` come from the rows, never from the clock, so an unchanged calendar gives the same bytes and the same `ETag`. `X-Robots-Tag: noindex`, `X-Content-Type-Options: nosniff`. No `Access-Control-*` header (no CORS), no `Set-Cookie`.
11. **The token stays out of the logs.** The process logs every request's URL; the request serializer replaces the token with `<token>`.
12. **The writer is Almanac's own**, about 300 lines in the feature folder: escaping, folding by octets, the components and `VTIMEZONE` from the runtime's zone data (Temporal's transitions). Rejected: ical-generator, which needs a second package for `VTIMEZONE` and whose folding and alarm handling would need checking anyway. `ical.js` (Mozilla, MPL-2.0) comes in as a dev dependency only, to parse the feed in the tests and expand its rules independently of rrule-temporal.

## Files you OWN

- `server/src/features/feed/` (new): `index.ts`, `routes.ts`, `store.ts`, `token.ts`, `ics.ts` (text values, folding, lines), `calendar.ts` (rows to components), `vtimezone.ts`, and their tests.
- `server/src/features/events/store.ts` and `index.ts`: a `listAll(userId)` read for the feed.
- `server/src/db/migrations.ts`: migration 5, `feed_tokens`, appended.
- `server/src/app.ts`: `@fastify/rate-limit` first, the feed feature last in `FEATURES`.
- `server/src/plugins/errors.ts`, `server/src/lib/api-error.ts`: the `rate_limited` code, the rate-limited 404 handler.
- `server/src/plugins/auth/index.ts`: the `PUBLIC_ROUTES` entry.
- `server/src/server.ts` and a pure log serializer in `server/src/lib/`: the redacted URL.
- `server/src/testing/featureApp.ts`: registers the rate-limit plugin the error plugin now needs.
- `server/package.json`, the root `package.json` (`ical.js` as a dev dependency), `package-lock.json`.
- `shared/src/feed.ts` (new) and `shared/src/index.ts`: the feed's state and link schemas.
- `web/src/account/CalendarFeed.tsx` and `web/src/account/feed-api.ts` (new), `web/src/layout/AccountMenu.tsx` (the menu item), `web/src/api.ts` (the new code in `ApiErrorCode`).
- `web/e2e/feed.spec.ts` (new), `web/e2e/fixtures.ts` (stateful feed answers), `web/playwright.config.ts` (the port from `E2E_PORT`, default 5177).
- Corpus: [wiki/decisions.md](../../wiki/decisions.md), [wiki/glossary.md](../../wiki/glossary.md), [wiki/features.md](../../wiki/features.md), [wiki/architecture.md](../../wiki/architecture.md), [wiki/data-model.md](../../wiki/data-model.md), a new wiki page, `calendar-feed.md`, [wiki/status.md](../../wiki/status.md), [log.md](../../log.md), the todo.
- `docs/owner-setup.md`: how to subscribe on Android.

## Files you must NOT touch

- `server/vendor/`, `web/vendor/`, `vendor/house-style/`: generated.
- The edit scopes, expansion and reminders: the feed reads rows and writes what they say.
- The deploy: no `vps-deploy` edit. The Caddy block already forwards `/almanac-api/*` and keeps no access log.

## What to do

One commit per step; `npm run check` passes after each.

1. **Promote** this brief from the todo; mark the todo promoted. Commit alone.
2. **The server.** Migration 5; the token helpers; the store; the writer and `VTIMEZONE`; the routes (`GET /api/feed` state, `POST /api/feed` a new link, `DELETE /api/feed` off, and the public feed); the rate limits and the `rate_limited` code; the `PUBLIC_ROUTES` entry; the log redaction. Tests below.
3. **The web.** Account menu, "Calendar feed…": a dialog with a switch. Off: what the feed is. Turning it on makes the link and shows it in a read-only field with "Copy link", and the line that it is shown once. On afterwards: since when, "New link" (a confirm: the old link stops working) and the switch off (a confirm: the link stops working). In the app's current look, with the glossary's words; "reminder", never "alarm". The Playwright spec walks it.
4. **Corpus and docs.** The decision entry (feed over CalDAV, no alarms, the token in the URL and why), the glossary's **Calendar feed**, the feature line, the route and the table, a `calendar-feed.md` page, the Android steps in `docs/owner-setup.md`. `bash corpus/lint.sh` clean.

## Acceptance

- [ ] Token tests: 32 random bytes, base64url, distinct across calls; the stored value is the SHA-256 and never the token; the comparison goes through `timingSafeEqual` and refuses a different or shorter value.
- [ ] The feed against a fixture week (one-offs, an all-day event, a timed series with a deleted occurrence and an exception, an all-day series, a reminder on several): every line ends in CRLF and is at most 75 octets, a fold never splits a UTF-8 character, unfolding gives back each value; commas, semicolons, backslashes and CR, LF and CRLF in a title, location or notes are escaped; a title holding `BEGIN:VALARM` stays text; no `VALARM` anywhere; `UID`s are the same on a second render; `ical.js` parses it and its expansion of the week matches `GET /api/occurrences`.
- [ ] `VTIMEZONE`: Bucharest's last-Sunday rules, a zone without summer time, a southern-hemisphere zone.
- [ ] Routes (bare `inject`, no cookie, for the feed): 200 `text/calendar; charset=utf-8` with the cache headers, an `ETag` and a `304`; no `set-cookie`, no `access-control-*`; a new link makes the old one a 404 and the new one a 200; off makes it a 404; another user's link never carries this user's events, and theirs never this user's; a malformed token is the same 404; `POST` to the feed URL is a 404; the 31st request in a minute is a 429 `rate_limited`; the token isn't in the log. The session routes have the stripped-field and the 500 tests.
- [ ] `npm run check` passes; the Playwright spec for the dialog passes with `--workers=2`; `bash corpus/lint.sh` is clean.

## Interplay

- The deploy is `all`: the server gains a route, a table and a dependency, and the web a dialog. Migration 5 runs on the first start.
- If `AUTH_TRUSTED_PROXIES` doesn't name the proxy's network in production, the feed's rate limit is one bucket for everyone (decision 9). The owner's check is in `docs/owner-setup.md`.
