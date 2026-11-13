# Task 05: A redesign with Hallmark, on the estate board

**Depends on:**

- In Almanac: [brief 03](../done/03-the-web-app-to-tailwind.md), which puts the web app on Tailwind tokens in one `@theme`, and builds the Light / Dark / System switch. A redesign is then mostly a new token set and layout. [Brief 02](../done/02-base-ui-by-the-conventions.md) fixes the Base UI wrappers it restyles.
- In the owner's skills library:
  - brief 24, which vendors Hallmark as the design skill and adopts taste-skill 2.5's ideas (palettes and type dealt by trade, its copy layer);
  - the estate redesign board: one artifact with a page per app, owned by the skills library.
- The owner's answer of 2026-11-10 (Q39): no bake-off; Hallmark redesigns every web UI, keeping what is useful from taste-skill 2.5, and the owner approves each app on the board before any code changes.

**Runs before:** nothing. **Runs after:** 01 to 04, the redesign last. Brief 04 is server-only and does not block it.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

Almanac is a calendar for a few private users: day, week, month and year views, quick create, an event form, calendars, search, a display time zone and phone notifications. It copies Google Calendar's layout on purpose.

### The screens (read 2026-11-10, `web/src/router.ts` and `web/src/layout/`)

| Screen | Route | File |
|---|---|---|
| Sign-in, the gate's loading and unreachable states | `/login` | `web/src/auth/LoginPage.tsx`, `web/src/auth/AuthGate.tsx` |
| The shell: top bar, sidebar with mini month and calendars, phone drawer, FAB | every page | `web/src/layout/AppShell.tsx`, `TopBar.tsx`, `Sidebar.tsx`, `MiniMonth.tsx`, `ViewSwitcher.tsx`, `AccountMenu.tsx` |
| Day, week, month (FullCalendar) | `/day/...`, `/week/...`, `/month/...` | `web/src/calendar/CalendarArea.tsx`, `content.tsx` |
| Year (our own) and its day popover | `/year/...` | `web/src/year/YearView.tsx`, `DayList.tsx` |
| Search and results | `/search` | `web/src/search/SearchBox.tsx`, `SearchResults.tsx` |
| Quick create, the event form, the repeat picker, the time field | an overlay on any view | `web/src/event/QuickCreate.tsx`, `EventForm.tsx`, `RepeatPicker.tsx`, `TimeField.tsx` |
| Event details popover and the edit-scope dialog | an overlay | `web/src/event/DetailsPopover.tsx`, `scope.tsx` |
| My calendars: list, row menu, colour palette, delete | the sidebar | `web/src/calendars/CalendarList.tsx`, `CalendarRow.tsx`, `ColorPicker.tsx` |
| Account: time zone, change password, notifications | dialogs from the account menu | `web/src/account/TimeZoneDialog.tsx`, `ChangePassword.tsx`, `Notifications.tsx` |
| Toast | every page | `web/src/components/ui/Toast.tsx` |

### What the design docs fix today

- [wiki/decisions.md](../../wiki/decisions.md), "Google Calendar's layout" (2026-10-16, revisited by brief 03 for the theme switch): the UI copies Google's layout straight, and themed directions were rejected for showcase and Shelfmark. [wiki/features.md](../../wiki/features.md) records the layout, and [wiki/web-app.md](../../wiki/web-app.md) the FullCalendar side.
- [wiki/overlays.md](../../wiki/overlays.md) fixes the Base UI overlays and their behaviours.
- The glossary words ([wiki/glossary.md](../../wiki/glossary.md)) are the UI's copy.
- The theme switch is the owner's call of 2026-11-10 (Q18): Light / Dark / System, light on a first visit, `data-theme` through `@custom-variant`. Brief 03 builds it, with a first-pass dark palette this brief refines.
- A calendar's colour comes from data (`--calendar-color`, `--swatch`), and the Monarch palette themes FullCalendar. Both stay data-driven.

The redesign stays inside these decisions unless the owner reopens one on the board. The layout copy of Google Calendar is the likeliest one to reopen.

## Owner decisions

Answered 2026-11-10: Q39 (Hallmark, with taste-skill 2.5's useful parts; approval on the board first). Default: the proposal keeps the four views, the sidebar, the phone drawer and the two-line grammar of the glossary. Anything that moves one of those is flagged on the board as a reopened decision.

## Files you OWN

- `web/src/styles/index.css` (the tokens), `web/src/calendar/fullcalendar.css` (the palette), and the screens listed above, one commit each.
- A `DESIGN.md` in `web/`, recorded from the shipped result.
- Corpus: [wiki/decisions.md](../../wiki/decisions.md) (the layout decision, if it changes), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md).

## Files you must NOT touch

- `server/` and `shared/`.
- The vendored Ward library in `web/vendor/`.
- The copy's meaning: wording stays unless the board approves a change. No invented facts or numbers, and no invented events in screenshots beyond the seed's.
- Behaviour: the Escape guard, focus handling, keyboard shortcuts and routes.

## What to do

1. **Today.** Take Playwright screenshots of every screen above at 1280 and 390 px, in light and dark, kept out of git. Use the seeded demo data and a frozen clock, as brief 03 does. Include the open menus, the drawer, the toast and the dialogs.
2. **Propose.** With Hallmark (and taste-skill 2.5's trade palettes and copy layer where they help), make a proposal per screen, inside the recorded decisions. Check each against the Floor: contrast, a visible focus ring, a reduced-motion path, no invented facts, no broken phone layout.
3. **Board.** Put the proposals on this app's page of the estate board, beside today's screenshots at both widths.
4. **Approval.** The owner approves on the board. Nothing below starts before that, and the approval is recorded in `log.md` with its date.
5. **Build.** First as a token change in `index.css` (colours, radii, shadows, type, spacing, both themes), then one screen per commit. Keep the Base UI wrappers and the theme switch working.

## Acceptance

- [ ] The owner's approval is on the board and recorded in `log.md` with the date.
- [ ] Contrast: every text and icon pair in both themes clears 4.5:1 (3:1 for large text and UI parts), measured with a script over the built tokens and listed in the outcome note. Calendar colours from data are checked against their event text colour.
- [ ] A Playwright test tabs through each screen and asserts a visible focus ring on every stop.
- [ ] A Playwright test with `reducedMotion: "reduce"` asserts no running animation or transition on each screen.
- [ ] A Playwright test at 390 px asserts `document.documentElement.scrollWidth <= window.innerWidth` on each screen.
- [ ] Every figure and name shown comes from the data or the copy; the outcome note lists none invented.
- [ ] The Light / Dark / System switch still works, with light on a first visit, and `npx playwright test` passes in light, dark and system.
- [ ] `npm run check` passes, and `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 03 owns the tokens, the cascade layers and the theme switch; this brief changes the values and layout on top. FullCalendar's layer order and its lazy stylesheet must survive.
- Brief 02's wrappers (`Dialog`, `Drawer`, `Menu`, `ToggleGroup`) are restyled, not replaced.
- Brief 01's formatter and lint run on every redesign commit.

## Outcome (2026-11-13)

Built on `main`, one commit per step, by redesign-almanac, from the owner's approval of "The week and its day" on the estate board (every question standing as proposed). The design is recorded in [web/DESIGN.md](../../../web/DESIGN.md); the reopened decisions are in [decisions.md](../../wiki/decisions.md) with their old lines kept.

- **Steps.** Approval line in the log; tokens and Sofia Sans (`@fontsource-variable/sofia-sans` and `-condensed`, both 5.3.0) with per-theme calendar colours; the shell (header band, left column cards, day card, drawer, phone strip and bottom bar); day, week and month on one card; the details popover and the phone's bottom sheet; the event form; year, search, sign-in; Playwright and the contrast script; docs.
- **Contrast** (`node scripts/contrast.mjs`, 66 pairs, 0 failing, in `npm run check`): text minimum 5.08:1 light and 5.07:1 dark; icons, edges and marks 3.09:1 and 4.02:1. Each calendar key's fill against its own text colour: 5.19 to 6.30 light, 8.92 to 9.59 dark. The six keys beyond the board's four come from its OKLCH recipe.
- **Browser tests** (`web/e2e`, `npx playwright test --workers=2`, light, dark and system): focus ring on every Tab stop, reduced motion, no overflow at 390 and 360 px, the theme switch with light on a first visit, and the first screens (the week to 21:00 with 15 blocks whole and the calendars in view; Save in view; Wednesday and Thursday whole at 390 x 844 and 360 x 800; the last row 32 px clear of Create).
- **Against the comps** (1280 / 390, light; dark within a point): week 11.4% / 15.6% differing pixels, details 12.6% / 9.6%, form 13.2% / 40.4% (before the phone form was put on its card over the page ground, as the comp draws it), week scrolled 17.8% at 390. What differs: the grid card starts 4 px higher so 21:00 fits; sub-pixel text and edge offsets; native select arrows; the search opener is drawn as the field but opens as before. Captures (never in git) are in the estate build folder's `impl/almanac/`.
- **Undrawn screens given the tokens and patterns:** sign-in and the gate, Day, Month, Year and its day popover, search and results, quick create, repeat picker, time field, edit-scope dialog, a calendar's menu, palette and delete, the account menu and its dialogs, the drawer, the toast.
- **Deviations.** Specs and captures use API stubs from the board's fixture week, not the demo seed (the seed is week-relative); the real API was checked by hand on a demo-seeded scratch server. Weekday heads are sentence case, as the direction sheet says. The details keep "Location" where the comp says "Where"; Reminder is a label over its value. Today's column wash is 40%, not 42%. The selection's block is neutral, so the accent never marks an event. Tests shim `Temporal.Now.instant`, which Chromium's own Temporal makes ignore a fake clock. Playwright is pinned in `web/package.json`. Dropped tokens, unused: `size-mini-cell`, `size-day-disc`, `size-day-disc-phone`, `shadow-raised-hover`.
- **New words:** none, beyond accessible labels ("Days of the week", "Now, 10:30", the day chips). Errors reuse "Your events couldn't be loaded." and "Try again".
- **Open.** The README images still show the old look (no retakes in this brief). `shared/src/calendar.ts` keeps Google's shades; a later brief.
- **Deploy:** `deploy` (static web only): `node cli.ts almanac deploy` from the vps-deploy checkout.
