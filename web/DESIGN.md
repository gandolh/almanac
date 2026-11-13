# Almanac's design

The look of the web app, as shipped by brief 05 (2026-11-13) from the owner's
approved direction "The week and its day". It is Almanac's own: olive-tinted
neutrals, raised cards, one moss accent, Sofia Sans. The layout is still the
familiar calendar's (four views, a left column, a drawer, a details popover),
which the owner asked to keep; the look is not Google's any more. The reasons
and the history are in `corpus/wiki/decisions.md`. The values below are the
tokens in `src/styles/index.css`; read them there, this page says what they are
for.

## The idea

The week grid shows where the time goes. Beside it, the chosen day reads as a
list, and its now rule mirrors the grid's now line, so "what's next" needs no
click. On the phone the week is a strip of seven day chips with a tick for each
event, over an agenda through Sunday.

## Colour

Every colour is `light-dark(light, dark)` inside `@theme static`, picked by
`color-scheme` on `:root` (Light, Dark, System: `src/layout/theme.ts`). Only the
shadows differ by theme, in the `[data-theme="dark"]` blocks after the theme.

| Role | Light | Dark | Used for |
|---|---|---|---|
| `ground` | #edede8 | #11110d | the page, behind the cards (on `html` and `body`) |
| `surface` | #fdfdfa | #22231e | cards, the header band, menus, popovers, dialogs |
| `field` | #e4e4de | #090907 | the search field, fields in a dialog, the all-day row |
| `control` | #e4e4de | #2c2d27 | a control under the pointer, the secondary button |
| `hairline`, `divider` | #d6d6cf | #3f3f38 | a card's edge, the grid's lines, rules inside a surface |
| `outline` | #808178 | #808178 | edges that must be seen: buttons, fields, checkboxes |
| `ink`, `ink-2`, `muted` | #1a1b14, #3d3e35, #5d5f56 | #eaeae4, #cfcfc7, #abaca3 | text, secondary text and icons, hours and labels |
| `accent` | #516312 (moss) | #bdd18f | Create, the chosen view and day, links, focus |
| `accent-tint` | #e4efce | #333c1e | the shown week, today's head, the chosen segment |
| `now-line`, `on-now` | #c1351e, #fdfdfa | #fa8467, #2a0e06 | the now line and its 10:30 chip |
| `danger` | #b02a2d | #f47a79 | Delete and errors, always with their words |

The moss shares its hue with the `olive` calendar key, so it marks only the
chosen view and day, Create, links and focus. It never marks an event.

### The calendar colours

The store keeps a key (`shared/src/calendar.ts`); the web maps each key to a
solid fill and the text on it, per theme (`--color-cal-<key>`,
`--color-on-cal-<key>`, and `calendarColor` and `calendarInk` in
`src/data/calendars.ts`). Light solids carry light ink, dark solids near-black.
Blue, green, orange and purple are the board's own values; the other six
(teal, olive, yellow, red, pink, graphite) come from the OKLCH recipe in the
board's direction notes: light solid (0.50, 0.13, hue) with the page's light
ink on it; dark solid (0.80, 0.11, hue) with (0.22, 0.04, hue) on it, at hues
195, 120, 90, 25, 0 and 260 (graphite at chroma 0.01). The shared file still
holds Google's old shades; changing it is a later brief's.

## Type

Sofia Sans (`font-sans`) for the interface and Sofia Sans Condensed
(`font-num`) for every date and time and the wordmark, in tabular figures. Both
are self-hosted variable fonts from `@fontsource-variable`, imported in the
`vendor` layer. Six sizes: 12, 13, 14, 16, 18 and 22 px.

| Token | Size | Where |
|---|---|---|
| `text-brand`, `text-range`, `text-day-number` | 22 | the wordmark (700), the range (600), a day's date (600) |
| `text-heading` | 18 | a card's head |
| `text-action-large`, `text-input-phone` | 16 | Create, the phone's rows, fields |
| `text-body`, `text-meta` | 14 | the interface and list rows |
| `text-small`, `text-event` | 13 | event titles, hints, labels |
| `text-label`, `text-mini`, `text-event-time` | 12 | hours, weekday initials, a block's time line |

## Shape and depth

Radii: 4 (a swatch), 6 (`radius-event`, a block), 10 (controls, fields), 12
(`radius-card`), 16 (a dialog), 20 (a phone sheet). A card has a hairline and
`shadow-card` in light; dark drops the shadow and keeps the edge. Menus and
popovers take `shadow-float`.

## Layout

- **From 1100 px:** a 56 px raised header band holds the menu button, the
  wordmark, Today, ‹ ›, the range, search, the Day / Week / Month / Year switch
  and the account disc. Under it, a left column of 276 px on `ground` (scrolling
  on its own): Create, the mini-month card, the My calendars card and the day
  card (`Wednesday, 11 November`, its rows, the now rule). The view is one
  raised card. The menu button hides the column.
- **768 to 1099 px:** the column is the drawer; the view switch is a row under
  the band; the week is the time grid.
- **Below 768 px:** the band holds the menu, the range, search, Today as an icon
  and the account. Week is a sticky strip of seven chips (weekday, date, a tick
  per event, up to six) over one card per day; tapping a chip moves the address to
  that day and the agenda scrolls to its card. The time grid stays in Day. A
  bottom bar (`ViewBar`) holds the four views; Create floats above it, extended,
  or a 56 px round button under 380 px. The list pads (104 px under the last card) so the last row sits 32 px
  clear of Create. A sideways swipe steps the view.

## The grid

48 px an hour (`--height-hour`), a 56 px day head, today's head on the accent
tint with its date on an accent tab and its column washed in the tint at 40%.
Blocks are solid fills with text on solid. Every block shows its start time: a
block of 45 minutes or more puts the time on a second line (the range from an
hour, the start in 11/14 under it); a shorter one is a single line, title then
start time, the time dropping out under 120 px wide; a block too small for both
shows its title alone, measured, never cut with an ellipsis. The now line is
2 px, with a chip in the hour gutter and no dot.

## Details, form, sheet

The details are a 340 px card: the calendar's mark and the title, the date, the
time on its own line, then labelled rows (Reminder, Location, Notes, Calendar)
and Delete (a danger button) with Edit (outlined). On a phone the same card is a
bottom sheet (`components/ui/Sheet.tsx`) with 48 px buttons. The event form is
a 640 px dialog with a visible label over each field, 40 px fields, 12 px gaps,
Reminder and Repeat on one row, Calendar and Location on the next, a scrolling
body and a footer that stays (Delete, Cancel, Save). Save is on the first screen
at 1280 x 800.

## Screens the board never drew

Given the tokens and these patterns, with no layout of their own: sign-in, Day,
Month, Year (on one card) and the year's day popover, search and its results (one
card), quick create, the repeat picker and the time field, the edit-scope dialog,
a calendar's row menu, palette and delete confirm, the account menu and its
dialogs (time zone, change password, notifications, theme), the drawer, and the
toast. Buttons: primary (moss), secondary (control fill), quiet (outlined),
danger (danger text, no fill).

## Checks

`node scripts/contrast.mjs` measures every text and icon pair of the tokens in
both themes (4.5:1 for text, 3:1 for icons and edges): see the outcome note of
brief 05 for the minimums. `web/e2e` holds the browser tests (a visible focus
ring on every Tab stop, reduced motion, no overflow at 390 and 360 px, the theme
switch, the first screens), run with `npx playwright test --workers=2` from
`web/`, in light, dark and system, against the API stubbed from the board's
fixture week.
