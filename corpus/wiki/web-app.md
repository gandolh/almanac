---
summary: How Almanac's web app is put together, as built 2026-10-16. The hand-rolled router and its URL scheme, the external-store data layer and the occurrences-changed signal, commands and keyboard shortcuts, the shell at three widths since brief 05 (header band and column from 1100 px, drawer, the phone's week strip, bottom bar and swipe, data-no-swipe), how FullCalendar is wired (its CSS in a layer and the Monarch palette on :root, in a sheet that loads with the lazy chunk; utilities through its class-name options; slots and snapping), and the rules the event editor, year view, calendar list, time zone dialog and search follow that the code alone doesn't explain.
updated: 2026-11-13
---

# Web app

`web/` is Vite + React on Shelfmark's patterns (`shelfmark`). What each screen
does is in [features.md](features.md); the overlays are in
[overlays.md](overlays.md); notifications in [notifications.md](notifications.md).
The code wins where this page and it disagree.

## Routes

`web/src/router.ts` is a hand-rolled History API router under the app's base.
`/<view>/:y/:m/:d` for day, week, month and year, written unpadded
(`/month/2026/1/5`); the full date is kept when switching views, as Google
does. `/search?q=…` shows results, `/login` signs in, and `/` goes on to this
month. "Today" is computed in the display time zone. A loose address is
rewritten to the canonical form and an impossible date goes home. Build and
read routes with `viewRoute` and `dateOfRoute`, never by hand.

## Data

- `data/store.ts` is a tiny external store read through
  `useSyncExternalStore`. `useCalendars()` and `useSettings()` sit on it, so
  a mutation re-renders every view.
- `data/occurrences.ts` has `fetchOccurrences`, `createEvent`, `updateEvent`
  and `deleteEvent`, validated with the shared zod schemas.
  `onOccurrencesChanged(listener)` fires after every successful write, and
  every open view (calendar, year, search) refetches on it.
- Dates go through `web/src/dates.ts` on `temporal-polyfill`: Monday weeks,
  24-hour `formatTime`, "16 Oct 2026" `formatDate`, range titles. Nothing
  relies on `toLocaleString` defaults that depend on the machine.

## Commands and shortcuts

`layout/commands.ts` lets a key or a button run a command without knowing who
answers: the event editor registers "create" and the search box
"focusSearch". `layout/shortcuts.ts` maps `t` today, `d` `w` `m` `y` views,
`j`/`n`/→ next, `k`/`p`/← previous, `c` create and `/` search. Keys typed into
inputs, with modifiers, or while a dialog or popover is open are ignored.

## Shell

- From 1100 px (`WIDE_QUERY`, `useIsWide`): a 56 px header band over a 276 px
  left column (`--width-sidebar`) that scrolls on its own: Create, the
  mini-month, My calendars and `DayCard` (the chosen day's rows and the now
  rule, `DayRows`). No rail, no right pane. The column's open state is
  remembered per browser in `localStorage`. The header's search is drawn as
  the field when closed, and opens on a click as before.
- From 768 px (`DESKTOP_QUERY`) to 1099 px: the column is a drawer (the menu
  button opens it) and the view switch (`ViewSwitcher`) is a row under the
  band. The week is the FullCalendar time grid.
- Below 768 px: the same drawer; the band has no wordmark and no ‹ › (a
  sideways swipe steps the view, `layout/swipe.ts`; anything that must not swipe
  carries `data-no-swipe`); Today is an icon. Week is `WeekAgenda`, not
  FullCalendar: a sticky strip of seven chips (a tick per event, up to six) and
  one card per day through Sunday, built from the same occurrences
  (`useOccurrenceSpan`). The address's date is the chosen day; a chip moves the
  address and the agenda scrolls to that day's card. Day, Month and Year stay as
  they are. `ViewBar` is the bottom bar of views; Create floats above it
  (extended, or a 56 px round button under 380 px).
- `CalendarArea` is lazy-loaded in `AppShell.tsx`, so the shell, year view and
  search load without FullCalendar, which is most of the bundle.

## FullCalendar

`web/src/calendar/`. FullCalendar v7 with `dayGrid`, `timeGrid`,
`interaction` and the Monarch theme. Its CSS and the palette live in
`calendar/fullcalendar.css`, the one stylesheet besides `styles/index.css`,
so they load with the lazy chunk only. The two FullCalendar imports sit in a
cascade layer (`fullcalendar`, under `components` and `utilities`), because
their own CSS is unlayered and would beat any utility. So the overrides are
utilities passed through FullCalendar's class-name options
(`slotHeaderInnerClass`, `eventTitleClass`, `columnEventClass`, the
`className` on its root) and Almanac's own markup (`calendar/content.tsx`),
and only the palette stays CSS. The palette is on `:root`, set in
`@layer base` from the tokens, rather than on the view, because a dragged
event leaves the view's subtree and would lose the colours. Two classes stay
as markers the selection code queries: `cal-mirror` and `cal-highlight`. The
text on an event is the per-theme `on-cal-<key>` token beside its solid fill
(`calendarColor`, `calendarInk` in `data/calendars.ts`), and FullCalendar's
`colorScheme` follows the theme. No FullCalendar toolbar; the shell's is
the only one, and FullCalendar's own navigation (day-number links, "+N more")
reports back through `onNavigate`. 30-minute slots, 15-minute snapping,
scrolled to 07:45. A click on the hours selects one hour.
Quick create holds the selection until it calls `releaseSelection()`
(`calendar/selection.ts`) on closing. A drag or resize on a series occurrence
asks the edit scope first; cancel or a server error reverts it.

`askScope` (`event/scope.tsx`) mounts in its own React root, so any screen can
ask "this, following or all" without a provider.

## Event editor

`web/src/event/`, pure rules in `editor-state.ts`.

- Quick create is a side popover on desktop; on a phone it opens the full
  form. The form is a large dialog that ignores backdrop presses, so a stray
  click can't throw away typing.
- A new event starts at the next full hour today in the display zone and
  lasts an hour; after 23:00 that is 00:00 tomorrow. Moving the start keeps the
  duration; start and end are sent together when either moved.
- An empty title saves as "(No title)", as Google does.
- `TimeField` takes "14:30" or "1430" or a pick from a 15-minute list; the end
  list shows durations ("11:00 (1 hr)").
- The repeat counts as changed only once its picker is touched and the rule
  differs, so moving one occurrence to another weekday still allows "This
  event". A changed repeat can't use "this".
- The default calendar is the last one used (`localStorage`), else the first
  visible one.
- Links in location and notes go through `linkify.tsx`: http(s) only,
  `rel="noopener noreferrer"`, no HTML injected.

## Year view

`web/src/year/`: twelve `MonthGrid`s; the day marking is pure logic in
`days.ts` (zone conversion, exclusive ends, DST days, hidden calendars
ignored). Columns follow a container query on the year section, not the
viewport, so they track the left column opening and closing.

## Calendars and time zone

- The row menu opens the colour palette as a popover of swatches ("Colour…"),
  not ten text items. The last calendar's Delete is disabled with "Only
  calendar" as its detail; a 409 from the server shows the same as a toast.
- The time zone list (`account/time-zones.ts`) adds UTC, runs west to east,
  and matches city, region and offsets ("+3", "gmt+3", "+5:30"), ignoring
  case and accents. It keeps the name as given (`Europe/Kyiv` stays), as
  the server's `isIanaZone` does.

## Search

The top-bar field (`search/SearchBox.tsx`) covers the whole bar on a phone.
Enter goes to `/search?q=`; Esc or back returns to the last calendar view.
Results are real links to the day, a request aborts when the query changes,
and a note shows when 50 come back. Results from hidden calendars are listed.
