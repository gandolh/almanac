# Task 06: Day, week and month views with FullCalendar

## Context

Replace the `CalendarArea` stub with FullCalendar v7 drawing day, week and
month, wired to the occurrences API, and add the details popover, drag, drop,
resize and the edit-scope question. Read [features.md](../../wiki/features.md)
("Views", "Interactions"), [glossary.md](../../wiki/glossary.md), the "Time
zones" section of [architecture.md](../../wiki/architecture.md), and the
FullCalendar entry in [research.md](../../wiki/research.md).
`@fullcalendar/react` 7.1.3 is installed by the controller (it exports
`/daygrid`, `/timegrid`, `/interaction` and themes under `/themes/*`); do not
run `npm install`.

Depends on: 04 (occurrence shape with series fields, `describeRepeat`,
scope semantics), 05 (shell, stubs, data hooks, Popover, Dialog, Toast,
`dates.ts`).

## Files you OWN

```
web/src/calendar/*          (CalendarArea.tsx replacing the stub, options, event content,
                             calendar.css, tests)
web/src/data/occurrences.ts  web/src/data/occurrences.test.ts
web/src/event/DetailsPopover.tsx  web/src/event/scope.tsx  web/src/event/linkify.tsx
web/src/event/details.css  web/src/event/*.test.ts (for these files)
```

## Files you must NOT touch

`web/src/layout/*`, `web/src/router.ts`, `web/src/App.tsx`,
`web/src/event/EventEditor.tsx` (brief 07), other stubs, `server/`, `shared/`.

## What to do

1. **`data/occurrences.ts`**: `fetchOccurrences(from, to)`, `createEvent`,
   `updateEvent(id, patch)`, `deleteEvent(id, { scope?, occurrence? })`, all
   validated with the shared schemas, and `onOccurrencesChanged(listener)`
   fired after every successful write so every open view refetches. Briefs
   07, 08 and 10 use these.
2. **`CalendarArea`**: FullCalendar with `dayGrid`, `timeGrid` and
   `interaction`; no FullCalendar toolbar (the shell has one); the view and
   date come from props and follow them with the calendar API, and
   FullCalendar's own navigation (nav links on day numbers, "+N more")
   reports back through `onNavigate`. Options: `timeZone` from
   `useSettings()`, `firstDay: 1`, 24-hour labels and event times,
   `nowIndicator`, 30-minute slots with 15-minute snapping, scrolled to 08:00,
   full height, `dayMaxEvents` in month, week headers like "MON 19" with
   today's number in the accent circle. Events come from an events function
   calling `fetchOccurrences` for FullCalendar's range, filtered to visible
   calendars and coloured from the calendar's colour; refetch on
   `onOccurrencesChanged` and when calendars or the time zone change. Pick
   the v7 theme closest to Google Calendar (try `classic` and `monarch`),
   override its colours with our tokens in `calendar.css`, light only.
3. **Creating**: a click or drag on empty time calls
   `useEventEditor().openQuickCreate({ start, end, allDay, anchor })` with
   the selection's element or rect; month clicks create all-day selections.
   Unselect when the editor closes.
4. **Details popover**: clicking an event opens `DetailsPopover` anchored to
   it: colour square and title, `formatDayLong` with the times (or "All
   day"; multi-day ranges show both dates), `describeRepeat` for a series,
   location and notes with links made clickable (`linkify.tsx`: http(s) URLs
   only, `rel="noopener noreferrer"`, `target="_blank"`, no HTML injection),
   the calendar's name. Buttons: Edit (`openEdit(occurrence)`), Delete, and
   close. Esc closes.
5. **Edit scope** (`scope.tsx`): `askScope({ action: "edit" | "delete",
   allowThis: boolean }): Promise<Scope | null>`, a small dialog with the
   three choices as radio buttons ("This event", "This and following
   events", "All events"), OK and Cancel, mounted in its own React root so
   any brief can call it. Brief 07 uses it too.
6. **Drag, drop, resize** (day and week: move and resize; month: move
   between days): for a series occurrence ask the scope first; then
   `updateEvent` with `{ scope, occurrence: originalStart, changes: { start,
   end, allDay } }`. Cancel or an error reverts the move; an error also
   shows a toast. Deleting from the popover asks the scope for a series and
   shows "Event deleted".
7. Tests (Node): the mapping from occurrences to FullCalendar event inputs
   (colours, hidden calendars, all-day dates), linkify, the
   change-notification wiring. FullCalendar itself is not rendered in tests.

## Acceptance

- typecheck, lint, `npx vitest run web` and build pass.
- In the browser with a few events and a weekly series: day, week and month
  show them in the display time zone with 24-hour times and weeks starting
  Monday; dragging a one-off moves it and survives a reload; dragging a
  series occurrence asks the scope and each choice does what
  [recurrence.md](../../wiki/recurrence.md) says; hiding a calendar hides its
  events.
- Hand back `askScope`, the `data/occurrences.ts` exports and how the
  editor's anchor is passed.

## Outcome

_2026-10-16_. Built and checked in a browser: display zone and a second zone,
24-hour, Monday start, the DST week, drag and resize with each scope, cancel
and server errors reverting, month moves, all-day to timed and back, the
details popover with links, delete, nav links, phone swipes. 433 tests.
FullCalendar's Monarch theme, with its palette mapped to our tokens on
`:root` (dragged events leave the view's subtree). A click on the hours
selects one hour, as Google does; events carry `data-no-swipe`. Brief 07
must call `releaseSelection()` whenever quick create closes. The bundle is
692 kB (204 kB gzip), over Vite's warning, mostly FullCalendar.
