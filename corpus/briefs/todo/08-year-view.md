# Task 08: Year view

## Context

Replace the `YearView` stub with Google's year view: 12 small months on one
screen, with a dot on days that have events, which Google doesn't do
([decisions.md](../../wiki/decisions.md), "FullCalendar v7 draws day, week
and month; the year view is our own"; [features.md](../../wiki/features.md)
"Views").

Depends on: 05 (`MonthGrid` with `size: "year"` and `marked`, `Popover`,
`dates.ts`, `useCalendars`, `useSettings`), 06 (`fetchOccurrences`,
`onOccurrencesChanged`).

## Files you OWN

```
web/src/year/YearView.tsx   (replaces the stub, same props)
web/src/year/DayList.tsx  web/src/year/year.css  web/src/year/*.test.ts
```

## Files you must NOT touch

`web/src/components/MonthGrid.tsx` (if it lacks something, report BLOCKED
with what), everything outside `web/src/year/`.

## What to do

1. Fetch the year's occurrences (1 January to 1 January in the display time
   zone) with `fetchOccurrences`, refetch on `onOccurrencesChanged`, on a
   year change and when the time zone changes. Ignore hidden calendars.
2. Lay out 12 `MonthGrid`s, 4 across on wide screens, 3, 2, then 1 as the
   width shrinks. Each month name is a button opening that month
   (`onOpenMonth`). Today is the accent circle. A day with events shows a
   small dot under its number; a multi-day event marks every day it covers.
3. Clicking a day opens a `Popover` with `DayList`: the day's title
   (`formatDayLong`), then its events in start order, each with a colour dot,
   "All day" or the 24-hour time, and the title. "No events" when empty.
   Clicking an event or the "Open day" link calls `onOpenDay(date)`.
4. Tests: marking days from occurrences (timed, all-day, multi-day crossing a
   month, events in hidden calendars ignored), DayList markup and ordering.

## Acceptance

- typecheck, lint, `npx vitest run web` and build pass.
- In the browser the year fits on a laptop screen without scrolling the page
  at 1440 × 900, the dots match the month view, and a click on a day lists
  its events and opens it.
