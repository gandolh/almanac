---
summary: How repeating events work in Almanac, planned 2026-10-16 and not built yet. The repeat presets, storing a series as one row with an RRULE plus exception rows, expanding occurrences on the server with rrule-temporal in the user's display time zone, and what each edit scope (this, this and following, all) does to the stored rows.
updated: 2026-10-16
---

# Recurrence

Planned, not built. The decision is in [decisions.md](decisions.md); the words
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

## Open for the brief

Search over series (match the series once, show its next occurrence) and how
a change of display time zone shows existing series are details for the brief
to settle against the code.
