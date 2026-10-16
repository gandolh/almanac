---
summary: How repeating events work in Almanac, as built by brief 04 on 2026-10-16. The repeat presets, storing a series as one row with an RRULE plus exception rows, expanding occurrences on the server with rrule-temporal in the zone each series was created in, and what each edit scope (this, this and following, all) does to the stored rows.
updated: 2026-10-16
---

# Recurrence

Built by brief 04 (`shared/src/repeat.ts`, `server/src/recurrence/`). The decision is in [decisions.md](decisions.md); the words
are in [glossary.md](glossary.md). This is the RFC 5545 model that Google's API
and ilamy-calendar also use ([research.md](research.md)).

## Presets

Does not repeat, daily, every weekday (Mon-Fri), weekly on chosen days,
monthly (same day of the month), yearly. Ends never, on a date, or after N
times. Each preset is one RRULE; there is no editor for arbitrary rules.

## Storage

- A series is one event row with `rrule` set, its first start, its duration,
  and the time zone its wall-clock times belong to (the user's display time
  zone when it was created).
- A deleted occurrence is an entry in the series' excluded dates.
- A changed occurrence is an exception: its own event row pointing at the
  series, with the original start it replaces.
- One-off events have no `rrule` and no series link.

## Expanding

The browser asks for a range (`from`, `to`). The server returns concrete
occurrences: one-off events in range, plus each series expanded with
rrule-temporal, minus excluded dates, with exceptions put in their place. Each
occurrence carries its series id and original start so an edit can find its
way back. FullCalendar only ever sees concrete occurrences.

## Edit scopes

- **This event**: deleting adds an excluded date; changing writes an
  exception.
- **This and following**: ends the old series just before this occurrence and
  starts a new series from it with the changes. Exceptions after the split
  move to the new series or are dropped if they no longer fit.
- **All events**: changes the series row. Exceptions stay unless the change
  moves the times, in which case Google drops them; Almanac does the same.

## As built

- A series' start is always its first occurrence: weekly on Monday from a
  Friday moves the start to the Monday, keeping time and length.
- `UNTIL` is the end date's last second in the series' zone, as UTC; all-day
  series use the date.
- "All" and "following" carry a changed title, location, notes or calendar
  onto exceptions that still had the series' old value, so a moved series
  doesn't leave occurrences behind in the old calendar's colour.
- Writes need a `scope` for series and exceptions (400 without one), and
  "this" and "following" need the occurrence key. A key that isn't a live
  occurrence is 404.
- Search shows a series once, at its first occurrence that hasn't ended
  (or its last one), and a matching exception as itself. With more than 50
  matches it keeps the 50 closest to now (those not over yet, soonest first,
  then the latest past ones) and shows them by date.
- A one-off given a repeat becomes a series in the display time zone it is
  edited in, which becomes its `tzid`.
- "All" moves the series by as far as the edit moved the occurrence from
  where it is now, so on an exception moved to another day, changing only
  the end moves nothing.
- An event lasts at most `EVENT_LENGTH_MAX_DAYS` (3660 days), and a repeat
  ends on `REPEAT_UNTIL_MAX` (9998-12-31) at the latest, so `UNTIL` in UTC
  keeps a four-digit year. A series that still fails to expand is logged and
  left out of `GET /api/occurrences` and `GET /api/search`; the rest
  answers.
- "Following" starts the new series the same way: at this occurrence's slot,
  moved as far as the edit moved the occurrence from where it is now, and a
  new repeat follows the occurrence's own date.
- Changing the display time zone leaves each series anchored in the zone it
  was created in; only the display shifts.
- A wall-clock time that doesn't exist (inside the spring-forward hour, e.g.
  03:30 on 29 March 2026 in Bucharest) is skipped by rrule-temporal rather
  than moved to 04:30 as RFC 5545 asks, and doesn't count toward `COUNT`.
  Known and accepted (review 2026-10-16); only events between 03:00 and
  04:00 on one night a year are affected.
