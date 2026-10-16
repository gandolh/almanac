# Task 05: App shell, routes, dates and design tokens

## Context

The frame every web brief fills in: Google Calendar's layout played straight,
light only ([features.md](../../wiki/features.md) "Layout", "Views",
[decisions.md](../../wiki/decisions.md) last entry). Words from
[glossary.md](../../wiki/glossary.md). Patterns: Shelfmark's `web/src/layout`,
`router.ts`, `components/` and `styles/` (`../shelfmark`), plus what brief 02
already copied here.

This brief also creates **stubs** that later briefs replace, so that briefs
06-10 can run in parallel without editing the shell. Each stub must have
exactly the props and exports below, render something harmless, and carry a
one-line comment naming the brief that replaces it.

Depends on: 02, 03 (calendars and settings routes). `temporal-polyfill`
1.0.6 is already installed in `web` by the controller; do not run
`npm install`.

## Files you OWN

```
web/src/router.ts  web/src/App.tsx  web/src/main.tsx
web/src/dates.ts  web/src/dates.test.ts
web/src/data/store.ts  web/src/data/calendars.ts  web/src/data/settings.ts  web/src/data/*.test.ts
web/src/layout/*            (AppShell, TopBar, Sidebar, MiniMonth, AccountMenu, ViewSwitcher,
                             viewport.ts, shortcuts.ts, commands.ts, tests)
web/src/components/*        (add MonthGrid, Popover, Dialog, Toast; keep 02's)
web/src/styles/*            (final tokens.css, base.css, components.css, shell.css)
web/public/*                (manifest.webmanifest, icons, favicon)
web/index.html
web/src/calendar/CalendarArea.tsx     STUB, replaced by brief 06
web/src/event/EventEditor.tsx         STUB, replaced by brief 07
web/src/year/YearView.tsx             STUB, replaced by brief 08
web/src/calendars/CalendarList.tsx    STUB, replaced by brief 09
web/src/account/TimeZoneDialog.tsx    STUB, replaced by brief 09
web/src/search/SearchBox.tsx          STUB, replaced by brief 10
web/src/search/SearchResults.tsx      STUB, replaced by brief 10
```

## Files you must NOT touch

`server/`, `shared/`, `web/src/auth/*`, `web/vendor/*`, `web/package.json`.

## What to do

1. **Routes** (`router.ts`): `day`, `week`, `month`, `year` as
   `/<view>/:y/:m/:d` (the full date is kept when switching views, as Google
   does), `search` as `/search` with `?q=`, `login`. `/` redirects to
   `/month/<today>`. "Today" is computed in the display time zone.
2. **`dates.ts`** (Temporal from `temporal-polyfill`): today in a zone; week
   starts Monday; the visible range for each view; previous and next for each
   view (31 Jan + 1 month clamps to 28 Feb); range titles ("16 October 2026",
   "19 – 25 Oct 2026", "Oct – Nov 2026" across months, "October 2026",
   "2026"); `formatTime` 24h ("14:30"); `formatDate` ("16 Oct 2026");
   `formatDayLong` ("Friday, 16 October"). English, no `toLocaleString`
   defaults that depend on the machine.
3. **Data** (`data/*`): a tiny external store (`useSyncExternalStore`) and
   `useCalendars()` returning `{ calendars, status, create, update, remove }`
   and `useSettings()` returning `{ timeZone, status, setTimeZone }`, both
   over the brief 03 routes with the shared zod schemas. Mutations update the
   store so every view re-renders.
4. **Shell**: `TopBar`: menu button (toggles the sidebar), app mark and
   "Almanac", Today, ‹ ›, the range title, `<SearchBox/>`, a view switcher
   (Day, Week, Month, Year), the account button with Shelfmark's
   `AccountMenu` (Change password, Sign in with Ward link or unlink, **Time
   zone…** opening `<TimeZoneDialog open onClose/>`, Sign out). `Sidebar`
   (256 px): a pill "Create" button calling `useEventEditor().openCreate()`,
   `MiniMonth` (own ‹ ›, today ringed, the shown date marked, a click moves
   the main view to that date), then `<CalendarList/>`. Main area: `<YearView/>`
   for year, `<SearchResults/>` for search, else `<CalendarArea/>`. Below
   768 px the sidebar is a drawer, the view switcher a menu, and Today an
   icon. Document title: "October 2026 · Almanac".
5. **Commands and shortcuts** (`commands.ts`, `shortcuts.ts`):
   `registerCommand(name: "create" | "focusSearch", fn): () => void` and
   `runCommand(name)`. Keys: `t` today; `d` `w` `m` `y` views; `j` or `n` or
   → next; `k` or `p` or ← previous; `c` runs "create"; `/` runs
   "focusSearch". Ignore keys typed into inputs, with modifiers, or while a
   dialog is open.
6. **Components**: `MonthGrid({ month: Temporal.PlainYearMonth, today,
   selected?, marked?: ReadonlySet<string>, onPickDay, size: "mini" | "year" })`
   with Monday-first weekday initials, used by MiniMonth now and the year
   view later. `Popover` (anchored to an element or a rect, flips at screen
   edges, closes on Esc and outside click), `Dialog` (modal; full-screen
   below 768 px), `Toast` with `showToast(message, { action? })`.
7. **Look**: finish `tokens.css` (the only file with colours and sizes):
   white surfaces, `#1f1f1f` text, `#444746` secondary, `#dadce0` hairlines,
   `#0b57d0` accent, today as a filled accent circle, 64 px top bar, system
   font stack with Roboto, 8 px radii, Google-like soft shadows on the Create
   button and popovers. Light only.
8. **Home-screen icon**: `manifest.webmanifest` (name Almanac, start_url
   `/almanac/`, display standalone, white theme), an SVG mark (a calendar
   page), PNGs at 192, 512 and 180 (apple-touch-icon), a favicon. No service
   worker.
9. **Stubs** with these exact signatures:
   - `CalendarArea({ view: "day" | "week" | "month", date: Temporal.PlainDate,
     onNavigate(view: View, date: Temporal.PlainDate): void })`
   - `EventEditorProvider({ children })` and `useEventEditor(): { openCreate(init?:
     { start?: string; end?: string; allDay?: boolean }): void; openQuickCreate(init:
     { start: string; end: string; allDay: boolean; anchor: Element | DOMRect }): void;
     openEdit(occurrence: Occurrence): void }`, wrapped around the shell in
     `App.tsx`. The stub's functions do nothing.
   - `YearView({ year: number, onOpenDay(date), onOpenMonth(date) })`
   - `CalendarList()` (stub: the calendars from `useCalendars()` with their
     colour, read-only)
   - `TimeZoneDialog({ open: boolean, onClose(): void })`
   - `SearchBox()` (stub renders nothing), `SearchResults({ query: string })`
10. Tests: `dates.ts` thoroughly; router parse and build; shortcut filtering;
    MonthGrid and MiniMonth markup (Monday first, today, marked days).

## Acceptance

- typecheck, lint, `npx vitest run web` and build pass.
- Signed in, `/almanac/` lands on this month; Today, ‹ ›, the view switcher,
  the mini-month and the keys move between views and dates and the URL
  follows; reload keeps the place; the phone width shows the drawer.
- Hand back every stub signature and the data hook shapes as built.

## Outcome

_2026-10-16_. Built and checked signed in, in a browser, desktop and 375 px.
Departures: `.gitignore` gained `!web/src/data/` because the root `data/`
rule hid the data layer; `web/src/App.test.ts` was replaced by layout and
component tests; the phone bar has no ‹ ›, a sideways swipe steps the view
instead (`layout/swipe.ts`, opt out with `data-no-swipe`), as in Google's
app; today is the filled accent circle everywhere; a round Create button on
phones; the sidebar's open state is remembered per browser. Stubs import
`styles/stubs.css`, to be deleted after the last stub goes.
