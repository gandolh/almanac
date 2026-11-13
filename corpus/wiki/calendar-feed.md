---
summary: How Almanac's calendar feed works, built 2026-11-13. One private read-only .ics link per user that a phone's calendar app subscribes to; how rows become VEVENTs (UTC one-offs, series in their zone with RRULE, EXDATE and RECURRENCE-ID, dates for all-day, a VTIMEZONE from the runtime's zone data, no VALARM); the token (256 bits, kept as its SHA-256, shown once); the routes, the 404, the rate limit, the cache headers and the log redaction; the account menu's dialog; subscribing on Android; the known edges.
updated: 2026-11-13
---

# Calendar feed

Built on 2026-11-13 (`server/src/features/feed/`, `web/src/account/CalendarFeed.tsx`).
The decision and what it beat are in [decisions.md](decisions.md); the word is
in [glossary.md](glossary.md). The code wins where this page and it disagree.

## What it holds

Every row the user has, in every calendar, hidden ones included, written as
stored. The calendar app expands the rules; the server expands nothing.

| Row | In the feed |
|---|---|
| Timed one-off | `DTSTART` and `DTEND` in UTC |
| All-day event | `VALUE=DATE`, the end exclusive as stored |
| Timed series | `DTSTART;TZID=<its tzid>` as wall-clock time, `RRULE:` and the stored rule (its `UNTIL` is UTC already) |
| All-day series | dates, `RRULE:` and the rule (`UNTIL` a date) |
| A deleted occurrence | `EXDATE` in the series' `DTSTART` form |
| Exception | a `VEVENT` with the series' `UID` and a `RECURRENCE-ID` in the series' form; its own times as a one-off's |
| Reminder | nothing: never a `VALARM` |

- `UID` is `event-<id>-<created, UTC>@almanac`, so an id SQLite hands out again
  after the newest row is deleted is still another event.
- `DTSTAMP`, `CREATED` and `LAST-MODIFIED` come from the row, so the same rows
  give the same bytes and the same `ETag`.
- Title, location and notes are TEXT values: `\`, `;` and `,` escaped, every
  line break `\n`, other control characters dropped. Lines fold at 75 octets,
  never inside a character.
- A `VTIMEZONE` for the display time zone and for each timed series' zone,
  from the runtime's zone data (Temporal's transitions): the current rules as a
  yearly `RRULE` started in 1970, as Google Calendar exports them; a zone with
  no summer time gets one observance; a zone no weekday rule fits (Cairo,
  Casablanca, Jerusalem, Santiago and a few more) gets its changes listed from
  the year before to ten years on. Apps that know the IANA name use their own
  data anyway.
- The header names the calendar "Almanac", gives `X-WR-TIMEZONE`, and hints a
  one-hour refresh (`REFRESH-INTERVAL`, `X-PUBLISHED-TTL`) for the apps that
  read it.

## The link

- `POST /api/feed` makes a token: 32 bytes from `crypto.randomBytes`,
  base64url (43 characters). `feed_tokens` keeps its SHA-256 and when it was
  made ([data-model.md](data-model.md)); the reply is the only place the link
  ever appears, with `Cache-Control: no-store`. A second `POST` replaces the
  hash, so the old link stops at once. `DELETE /api/feed` turns it off.
  `GET /api/feed` says whether it is on and since when, never the link.
- The link is `<PUBLIC_ORIGIN><ALMANAC_API_PREFIX>/api/feed/<token>/almanac.ics`.
  The route is in `PUBLIC_ROUTES`, so the sign-in library lets it through
  without a session, and it never reads one; a cookie sent along is ignored and
  never renewed.
- A token is looked up by its hash and the stored hash compared with
  `timingSafeEqual`. A token of the wrong shape, unknown, replaced or off gets
  the same `404 not_found`, "There is no such route.", as a route that doesn't
  exist.
- `GET` and `HEAD` only. Another method finds no route; without a session the
  sign-in library's guard answers 401 first. A token over the router's
  100-character limit gets Fastify's own `414` (`FST_ERR_MAX_PARAM_LENGTH`),
  whose body repeats the path to whoever sent it; the log still shows
  `<token>`.
- 30 requests a minute per address (`@fastify/rate-limit`), wrong tokens
  included, then `429 rate_limited` with `Retry-After`.
- `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: private,
  no-cache`, a strong `ETag` over the body and `304` on a matching
  `If-None-Match`, `X-Content-Type-Options: nosniff`, `X-Robots-Tag: noindex,
  nofollow`. No `Access-Control-*` header, no `Set-Cookie`.
- The process logs every request's URL; pino's `redact` (`server/src/lib/log.ts`)
  writes `/api/feed/<token>/almanac.ics` instead. The Caddy block keeps no
  access log.

## The dialog

Account menu, Calendar feed…: a switch, "Feed for a calendar app". Turning it
on makes the link and shows it read-only with Copy link, the line that
Almanac can't show it again, and how to add it in ICSx⁵. Closed and opened
again, it says "On since <date>" and that the link was shown once. New link
and off each ask first (`ConfirmDialog`). The Playwright spec is
`web/e2e/feed.spec.ts`.

## Subscribing on Android

ICSx⁵ (free on F-Droid and Google Play) turns a link into a calendar the
phone's own calendar app shows. In Almanac: account menu, Calendar feed…, turn
it on, Copy link. In ICSx⁵: +, paste the link, leave the user name and password
empty, name it, and pick the sync interval in its settings. The events show
read-only; edit them in Almanac. Not tried on a real phone yet.

## Known edges

- A wall-clock time inside the spring-forward hour: Almanac skips it
  ([recurrence.md](recurrence.md)); a calendar app following RFC 5545 shows it
  an hour later.
- A timed series' length is `DTEND` minus `DTSTART`, which RFC 5545 reads as
  exact time; Almanac keeps the wall-clock length. They differ only for an
  occurrence the clocks change during.
- A user whose Ward grant is withdrawn keeps a working link until the feed is
  turned off or the user deleted: it holds only that user's own events.
