# Task 04: Repeating events: rules, expansion and edit scopes

## Context

Read [recurrence.md](../../wiki/recurrence.md) (the model), the
"Common repeats" entry in [decisions.md](../../wiki/decisions.md),
[glossary.md](../../wiki/glossary.md) and the "Time zones" section of
[architecture.md](../../wiki/architecture.md). Brief 03 built the schema, the
route shapes and the low-level store writes; this brief makes series work end
to end on the server. Nothing in `web/`.

Libraries: `rrule-temporal` 2.2.8 and `temporal-polyfill` 1.0.6 (exact;
Node 24 has no global `Temporal`, import it from the polyfill, don't install
it globally). Do not use rrule.js.

Depends on: 03.

## Files you OWN

```
shared/src/repeat.ts  shared/src/repeat.test.ts  shared/src/index.ts (export it)
shared/package.json   (only if a shared dependency is needed)
server/package.json   (add the two libraries)
server/src/recurrence/expand.ts  server/src/recurrence/scopes.ts
server/src/recurrence/*.test.ts
server/src/routes/events.ts  server/src/routes/occurrences.ts  server/src/routes/search.ts
server/src/routes/*.test.ts  (the ones for these three routes)
server/src/store/events.ts   (only additions needed by scopes; keep 03's interface)
```

## Files you must NOT touch

`server/src/auth/*`, `server/src/db/migrations.ts` (if the schema is
missing something, report BLOCKED with what and why), `web/`.

## What to do

1. `shared/src/repeat.ts`: `repeatToRRule(repeat, start)` and
   `rruleToRepeat(rrule)` for the five presets (weekdays is
   `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`, weekly takes `byDay`, defaulting to the
   start's weekday; monthly is the start's day of month; yearly the start's
   date), with ends never, `UNTIL` (inclusive of that date in the series'
   zone; follow RFC 5545 and rrule-temporal's README on UNTIL for TZID
   starts) and `COUNT`. `describeRepeat(repeat, start)` gives the UI text:
   "Daily", "Every weekday (Monday to Friday)", "Weekly on Monday, Wednesday",
   "Monthly on day 16", "Annually on 16 October", plus ", until 1 Dec 2026"
   or ", 10 times".
2. `expand.ts`: `expandSeries(series, exceptions, from, to)` returns the
   occurrences overlapping the range. Timed series expand as
   `ZonedDateTime`s in the series' `tzid`, so a 10:00 weekly meeting stays
   10:00 local across the DST change (Europe/Bucharest leaves summer time on
   2026-10-25); duration is kept in wall-clock terms. All-day series expand
   by date. Remove `exdates`; replace an occurrence that has an exception row
   with the exception (which may have moved, even out of the range). An
   occurrence starting before `from` but ending after it is included. Guard
   against runaway rules (cap at 1000 occurrences per series per request).
3. `GET /api/occurrences` now returns one-offs, generated occurrences
   (`id: "s<seriesId>:<key>"`, `eventId` = series id, `seriesId`,
   `originalStart` = key) and exceptions (`eventId` = their own row,
   `seriesId`, `originalStart`), sorted by start.
4. `POST /api/events` accepts a repeat; stores `rrule` from
   `repeatToRRule`.
5. `scopes.ts`, each in one transaction, called from the events routes:
   - **this**: on a generated occurrence, write an exception row with the
     changes (`original_start` = key); on an exception, update it. Delete
     adds the key to `exdates` (and removes an exception row if there was
     one). A `repeat` change is not allowed with this scope (400).
   - **following**: end the old series the day before this occurrence
     (`UNTIL`, or recompute `COUNT` so the old part keeps exactly the
     occurrences before it), create a new series from this occurrence with
     the changes, move exceptions and exdates at or after the split to the
     new series, re-keyed if the start time moved, dropping any that no
     longer fall on the new rule. If this is the first occurrence, behave as
     **all**. Delete ends the series before this occurrence.
   - **all**: update the series row. If the time or the repeat changed, drop
     the exceptions and exdates (Google does the same); title, location,
     notes and calendar changes apply to the series and leave exceptions
     alone. Moving by drag (start changed, same duration) shifts the whole
     series by the same offset. Delete removes the series and its exceptions.
   - One-off events ignore `scope`.
6. Search: a series appears once, as its next occurrence from now (or its
   last one if it has ended); exceptions whose text matches appear as
   themselves.
7. Tests (most of the effort goes here): each preset over a month; UNTIL and
   COUNT ends; the DST week in Europe/Bucharest; exdates; a moved exception
   showing inside and outside the range; each scope for edit and delete,
   including following on the first occurrence and following with COUNT;
   drag-shifting all; another user's series returns 404.

## Acceptance

- typecheck, lint, test and build pass.
- `GET /api/occurrences` for October 2026 on a weekly Monday 10:00
  Europe/Bucharest series returns 10:00 local on 19 and 26 October (UTC
  `07:00Z` then `08:00Z`).
- Hand back `describeRepeat`'s signature and the exact scope semantics for
  the web briefs.

## Outcome

_2026-10-16_. Built; 262 server and shared tests, the Bucharest DST check
passes (19 Oct `07:00Z`, 26 Oct `08:00Z`). Accepted calls beyond the text:
"all" and "following" carry changed title, location, notes or calendar onto
exceptions that still had the series' old value; a series' start snaps
forward to its first real occurrence; the repeat functions take the time
zone as a third argument and write explicit `BYDAY`/`BYMONTHDAY`/`BYMONTH`;
`UNTIL` is the end date's last second in the series' zone (date for
all-day); `rowOccurrence` moved to `recurrence/expand.ts`; the store gained
`moveException`. Missing scope or occurrence on a series write is 400; a key
that is not a live occurrence is 404.
