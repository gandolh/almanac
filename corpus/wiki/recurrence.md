---
summary: How repeating events work in Almanac, as built by brief 04 on 2026-10-16. The repeat presets, storing a series as one row with an RRULE plus exception rows, expanding occurrences on the server with rrule-temporal in the user's display time zone, and what each edit scope (this, this and following, all) does to the stored rows.
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
  (or its last one), and a matching exception as itself.
- Changing the display time zone leaves each series anchored in the zone it
  was created in; only the display shifts.
