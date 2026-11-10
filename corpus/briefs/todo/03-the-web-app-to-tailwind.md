# Task 03: The web app to Tailwind

**Depends on:**

- In Almanac:
  - brief 01, for the gate, the formatter and the `.claude/rules/web.md` this brief extends;
  - brief 02, which puts the Base UI wrappers in `web/src/components/ui/` and settles their markup, so this brief styles each part once, in its final place.
- In the owner's skills library:
  - brief 02, *A base-ui skill, styled with Tailwind*: rules 4-8, the `tailwind.md` reference and the method in `migrating-from-plain-css.md`;
  - brief 27, *A house style, and a quality harness that enforces it*: the `better-tailwindcss` lint;
  - brief 06, *Almanac's web app to Tailwind*, the estate draft this brief replaces.
- The owner's grilling of 2026-11-10:
  - Q17 (token names);
  - Q18 (dark mode);
  - Q19 (visual parity);
  - Q20 (the order of the migrations);
  - the new questions in decisions 4 and 5.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The owner's call of 2026-11-09: Base UI is styled with Tailwind v4, and whole apps move to Tailwind, not only the Base UI parts. Almanac's web app is plain CSS on tokens today. This brief moves all of it to Tailwind 4.3.5 with the looks unchanged, and it is the deep version of the skills library's draft (its brief 06). Where this brief and that draft disagree, this brief was measured against the code on 2026-11-09.

### Corrections to the estate draft

- **Tokens.** `tokens.css` has **117** custom properties (120 definitions, three of them redefined under 768 px), not 159. The 159 counted definitions across every stylesheet: `tokens.css`'s 120, `calendar.css`'s 35 Monarch variables, `components.css`'s four and `year.css`'s two (161 by a strict count). All 117 are read somewhere.
- **Dark mode.** No dark or theme selector is live. The draft's hit was `color-scheme: light` in `web/src/styles/base.css:7`, which forces light, and the word "theme" in a comment in `calendar.css`. `web/index.html` sets `<meta name="color-scheme" content="light">`, and FullCalendar gets `colorScheme: "light"`. So there is no `@custom-variant dark`, as [wiki/decisions.md](../../wiki/decisions.md), "Google Calendar's layout, light only", says.
- **FullCalendar's overrides can become utilities.** Every selector in `calendar.css` but the Monarch palette targets a class Almanac hands FullCalendar itself, through v7's class-name options (`className`, `slotHeaderInnerClass`, `eventClass`…), or Almanac's own markup in `web/src/calendar/content.tsx`. None aims at FullCalendar's internal `.fc-*` classes. The catch is the cascade:
  - FullCalendar's `skeleton.css` and `@fullcalendar/react/themes/monarch/theme.css` are **unlayered**, read from the 7.1.3 package, and unlayered CSS beats any rule in a cascade layer whatever its specificity.
  - So a utility, or the draft's `@layer components`, would lose to Monarch where both set a property. Monarch gives the slot label `margin-block: 8px` and `font-size: 14px`, and Almanac overrides those today with `.calendar-area .cal-slot-label`.
  - The fix is to import FullCalendar's CSS **into a layer below `utilities`** (decision 6). Then the overrides become utilities passed through the same options, and only the palette stays as CSS.

### The stylesheets today

Fourteen files, **3,412 lines**, all under `web/src/`. Between them:

- 259 distinct class selectors;
- 282 `className` attributes in 39 `.tsx` files;
- 20 `@media` blocks:
  - 15 at `max-width: 767.98px`;
  - one each at 1199.98 px and 899.98 px;
  - one `(hover: none)`;
  - two `prefers-reduced-motion`;
- 4 `@container` queries;
- 7 `@keyframes`;
- 16 transitions;
- 4 `!important`, all in the reduced-motion rule.

There are no `rem` units; there are 468 `px` values and 6 `em`s.

| File | Lines | Imported by | What it styles |
|---|---|---|---|
| `web/src/styles/components.css` | 632 | `main.tsx` | Button (variants, sizes, the phone's 44 px targets), the icon button, Menu (trigger label, positioner, list, sections, items, tick), Popover, Dialog (backdrop, three widths, frame, head, body, footer, full screen on a phone), Toast, MonthGrid (mini and year). Four keyframes. |
| `web/src/styles/shell.css` | 507 | `main.tsx` | The shell: layout, skip link, top bar (brand, the app mark's colours, Today, ‹ ›, the range title), view switcher segments and the phone's view menu, account button, disc and notice, left column, Create, mini-month head, the phone's compact bar, drawer scrim and panel, FAB. Two keyframes. **No `@media`:** the phone layout is `.shell--phone` and `.topbar--compact`, set from JS (`DESKTOP_QUERY`, `web/src/components/viewport.ts`). |
| `web/src/event/editor.css` | 410 | `EventForm`, `QuickCreate`, `RepeatPicker`, `TimeField` | The event form's fields, rows, the When row, the time field and its list (`z-index: 1` at 217), the repeat picker and weekday toggles, the calendar picker, quick create. |
| `web/src/calendars/calendars.css` | 290 | `CalendarList`, `CalendarRow`, `ColorPicker` | "My calendars": heading and +, rows (a checkbox drawn in the calendar's colour, the name, ⋮ on hover or focus, always shown under `(hover: none)`), the rename field, the palette, the two dialogs. |
| `web/src/search/search.css` | 268 | `SearchBox`, `SearchResults` | The top bar's field (narrower under 1200 and 900 px, covering the bar on a phone), results grouped by date. |
| `web/src/auth/auth.css` | 236 | `AuthGate`, `LoginPage`, **and** `web/src/components/Field.tsx`, `web/src/account/TimeZoneDialog.tsx`, `web/src/calendars/CalendarList.tsx` | The gate's screens and the login panel, **and the app's shared field and error styles** (`.auth-field*`, `.auth-error*`), which every form uses. One keyframe. |
| `web/src/year/year.css` | 180 | `YearView` | The year layout by container query (1-4 columns at 472, 720 and 968 px, with `--year-cell` and `--year-day` redefined from `100cqw` under 472), a month, the day list in its popover (`.popover.day-popover`). |
| `web/src/styles/tokens.css` | 179 | `main.tsx` | The 117 tokens on `:root`, and the editor's three phone sizes. |
| `web/src/calendar/calendar.css` | 163 | `CalendarArea` (the lazy chunk) | The Monarch palette (35 `--fc-monarch-*` on `:root`), the calendar area, column heads, the hour labels, half-hour lines, event ellipsis, the selection mirror's shadow, the all-day label. |
| `web/src/styles/base.css` | 156 | `main.tsx` | The page: `color-scheme: light`, the root's type (**15 px on `:root`**), box sizing, element margins, `text-wrap`, form controls inheriting type, `caret-color`, selection, the one keyboard focus ring, links, tabular `time`, thin scrollbars, `.visually-hidden`, the reduced-motion override. |
| `web/src/event/details.css` | 124 | `DetailsPopover`, `web/src/event/scope.tsx` | The details popover's rows, and the edit-scope dialog's choices. |
| `web/src/account/time-zone.css` | 120 | `TimeZoneDialog` | The current zone, the list rows and tick. |
| `web/src/push/notifications.css` | 114 | `web/src/account/Notifications.tsx` | The notifications dialog's rows and hints, and the Switch (track, thumb, a 44 px target, states). |
| `web/src/account/account.css` | 33 | `ChangePassword` | The change-password form, and the account notice's error state, which extends `shell.css`'s `.account__notice`. |

FullCalendar's own CSS is imported in `web/src/calendar/CalendarArea.tsx:19-20`:

- `@fullcalendar/react/skeleton.css`: 8.9 kB, 2.4 kB gzip;
- `@fullcalendar/react/themes/monarch/theme.css`: 15.3 kB, 3.0 kB gzip.

Both load only with the lazy chunk.

### The token mapping plan

Tailwind 4.3.5's theme namespaces, read from its `theme.css` and its utilities' theme keys, take most of Almanac's names unchanged. The values stay exactly as `tokens.css` has them.

| Group (`tokens.css` lines) | Count | Today | In `@theme` | Utility example |
|---|---|---|---|---|
| Colour (17-35) | 19 | `--ground`, `--surface`, `--control`, `--field`, `--hairline`, `--divider`, `--outline`, `--ink`, `--ink-2`, `--muted`, `--accent`, `--accent-press`, `--accent-ink`, `--accent-tint`, `--accent-tint-soft`, `--toast-surface`, `--toast-ink`, `--toast-action`, `--now-line` | `--color-<same name>` | `bg-surface`, `text-ink-2`, `border-hairline` |
| Derived (39-50) | 11 | `--on-accent`, `--control-hover`, `--control-press`, `--hover`, `--press`, `--field-placeholder`, `--focus-ring`, `--selection`, `--scrollbar-thumb`, `--scrim`, `--toast-hover`: mixes and aliases | `--color-<same name>`, their `var()`s pointing at the `--color-*` names | `bg-hover`, `bg-scrim` |
| Font (54) | 1 | `--font-sans` | `--font-sans`, the same name; it replaces Tailwind's | `font-sans` |
| Type sizes (56-72) | 17 | `--text-title` … `--text-event` | `--text-<same name>`, already Tailwind's namespace | `text-body`, `text-mini` |
| Weights (74-77) | 4 | `--weight-regular`, `-medium`, `-semibold`, `-bold` | `--font-weight-<same suffix>` | `font-semibold` |
| Tracking (79) | 1 | `--tracking-title` | the same | `tracking-title` |
| Leading (81-83) | 3 | `--leading-body`, `-phone`, `-tight` | the same | `leading-body` |
| Radii (87-92) | 6 | `--radius-small`, `-control`, `-field`, `-container`, `-sheet`, `-pill` | the same | `rounded-control`, `rounded-pill` |
| Shadows (97-103) | 4 | `--shadow-raised`, `-raised-hover`, `-float`, `-dialog` | the same | `shadow-float` |
| Sizes (107-134) | 28 | touch and control heights, icon buttons, bar, column, drawer, Create, FAB, disc, mini-month and year cells, dot, swatch, popover, day discs, menu, the three dialog widths, toast, gutters | by use: `--size-*` (squares: `touch`, `icon-button`, `fab`, `mini-day`, `day-disc`…), `--height-*` (`topbar`, `control`, `outlined`, `create`), `--width-*` (`sidebar`, `drawer`, `popover`, `menu`), `--container-*` (`dialog-small`, `-medium`, `-large`, `toast`), `--spacing-*` (`gutter-desktop`, `gutter-phone`) | `h-topbar`, `w-sidebar`, `size-icon-button`, `max-w-dialog-medium` |
| Search (138-145) | 8 | dot, day popover, three field widths, two result columns, reading width | `--size-search-dot`, `--width-day-popover`, `--width-search-field*`, `--container-search-content`; the two grid columns stay plain `:root` variables | `w-search-field`, `grid-cols-[var(--search-date-column)_1fr]` |
| Editor (149-155) | 7 | field height, row lead, date, time and count widths, time list height, day toggle | `--height-editor-field`, `--spacing-editor-lead`, `--width-*-field`, `--height-time-list`, `--size-day-toggle` | `h-editor-field max-md:h-touch` |
| Layers (159-162) | 4 | `--z-bar`, `--z-drawer`, `--z-float`, `--z-toast` | `--z-index-bar`, `-drawer`, `-float`, `-toast` | `z-float` |
| Motion (166-169) | 4 | `--ease-out`, `--duration-fast`, `--duration`, `--duration-sheet` | `--ease-out`, the same name; it replaces Tailwind's `cubic-bezier(0, 0, 0.2, 1)` with Almanac's `cubic-bezier(0.22, 1, 0.36, 1)`. The durations stay plain variables. | `ease-out duration-(--duration)` |

The three phone redefinitions (`tokens.css:172-179`) become responsive utilities where they're used (`max-md:h-touch`), not global overrides.

The names that change are referenced in these places beyond the CSS files being deleted:

- `web/src/calendar/events.ts:53`: `eventInk()` returns `"var(--ink)"` or `"var(--on-accent)"` for FullCalendar's text colour. Its tests are `web/src/calendar/events.test.ts:69, 77, 103, 105`.
- The Monarch palette, which reads them.
- `year.css:48-49`, redefining `--year-cell` and `--year-day` inside a container query.
- `components.css:536-544`, the MonthGrid's local `--cell` and `--day`. These become arbitrary properties on the grid (`[--cell:var(--size-mini-cell)]`).

### The FullCalendar selectors (`web/src/calendar/calendar.css`)

| Lines | Selector | Where the class comes from | Overrides Monarch? | Becomes |
|---|---|---|---|---|
| 9-56 | `:root { --fc-monarch-* }` (35) | FullCalendar's theme variables, set on `:root` because a dragged event leaves the view | sets the palette | **stays CSS**, in `index.css`'s `@layer base`, reading the renamed tokens |
| 59 | `.calendar-area` | Almanac's `<section>` (`CalendarArea.tsx:197`) | no | utilities |
| 68 | `.calendar-area .cal` | the `className: "cal"` option (`CalendarArea.tsx:236`) | type and colour on the root | utilities in `className` |
| 79-127 | `.cal-head`, `__weekday`, `__day`, `:hover`, `--today`, the phone size | Almanac's spans in `web/src/calendar/content.tsx:52-54` (`dayHeaderContent`) | no | utilities, `group-hover:`, `max-md:` |
| 131 | `.calendar-area .cal-slot-label` | `slotHeaderInnerClass` (244) | **yes**: Monarch's `margin-block: 8px`, `font-size: 14px` | utilities in the option, which needs decision 6 |
| 139 | `.calendar-area .cal-half-hour` | `slotLaneClass` and `slotHeaderClass` for minor slots (246-247) | **yes**: the line colour | the same |
| 145 | `.cal-event-title, .cal-event-time` | `eventTitleClass`, `eventTimeClass` (257-258) | ellipsis | the same |
| 155 | `.cal-mirror` | `eventClass` for the mirror (279) | shadow | a utility **plus the bare `cal-mirror` class**, which `CalendarArea.tsx:367` queries |
| 160 | `.calendar-area .cal-all-day` | `allDayHeaderInnerClass` (266) | **yes**: colour and size | utilities in the option |
| none | `cal-highlight` | `highlightClass` (278) | | a **marker only**, no CSS; `CalendarArea.tsx:367, 372` query it, so it stays |

### Classes the code reads, not only the stylesheet

- `.dialog__footer` (`web/src/components/Dialog.tsx:54`): brief 02 replaces it with a ref.
- `.calendar-row__input` (`web/src/calendars/CalendarRow.tsx:223`): becomes a ref.
- `.cal-mirror` and `.cal-highlight`: stay as markers (above).
- **Tests:** 31 assertions on class names in 7 files, to rewrite as roles, text, or `data-` attributes:
  - `web/src/components/components.test.ts`: 75, 84, 86, 95, 104, 116, 117, 119;
  - `web/src/auth/auth.test.ts`: 36;
  - `web/src/event/details.test.ts`: 91, 94, 98, 113, 121, 124;
  - `web/src/event/editor.test.ts`: 69, 147, 192;
  - `web/src/search/search.test.ts`: 148, 154, 159;
  - `web/src/year/year.test.ts`: 231, 236, 242, 277;
  - `web/src/calendars/calendars.test.ts`: 43, 44, 51, 56;
  - `web/src/calendar/events.test.ts`: 189, 192.

  `events.test.ts:209` asserts FullCalendar's own `timeClass` and `titleClass`, and is unaffected. The `--calendar-color` and `--swatch` assertions stay (the next point).
- **Inline styles:** six props set a calendar's colour from data:
  - `web/src/event/EventForm.tsx:393`;
  - `web/src/event/DetailsPopover.tsx:96`;
  - `web/src/search/SearchResults.tsx:158`;
  - `web/src/year/DayList.tsx:54`;
  - `web/src/calendars/ColorPicker.tsx:70`;
  - `web/src/calendars/CalendarRow.tsx:251`.

  They stay as `--calendar-color` and `--swatch`, read with `bg-(--calendar-color)`. That is data, not a design colour, so it gets an exception in `scripts/conventions.json` (rule 5 allows inline style only for computed geometry).

### Gotchas Tailwind brings to this app

- **The 15 px root.** `base.css` sets `font-size: var(--text-body)` (15 px) on `:root`. So every rem-based Tailwind default would come out 15/16 of its size: `p-4` would be 15 px. Decision 5.
- **Default names that collide:**
  - `--font-sans`, `--ease-out` and `--leading-tight` exist in Tailwind's theme with other values;
  - and Tailwind's palette, text scale, radii and shadows would be usable beside Almanac's.

  Clear each default namespace (`--color-*: initial`, and so on) before defining Almanac's, so only Almanac's tokens exist.
- **`tailwind-merge` doesn't know custom size names.** Unconfigured, `cn("text-ink", "text-body")` treats both as colours and drops one. `web/src/lib/cn.ts` uses `extendTailwindMerge` with Almanac's `text`, `radius`, `shadow` and spacing names, and has a test for exactly that case.
- **`hover:` is hover-capable only.** In Tailwind v4, `hover:` applies under `@media (hover: hover)`. A tap on a phone no longer leaves a hover state behind. That is an expected difference to list. The `(hover: none)` rule in `calendars.css:143` becomes an arbitrary `[@media(hover:none)]:` variant.
- **Breakpoints.** `max-md:` is `@media (width < 48rem)`. Media queries ignore the root font size, so that is exactly today's `max-width: 767.98px`, and `md:` matches `DESKTOP_QUERY`. The two search widths are `max-[1200px]:` and `max-[900px]:`.
- **Container queries.** `year.css`'s `@container year (…)` becomes `@container/year` with `@min-[472px]/year:`, `@min-[720px]/year:`, `@min-[968px]/year:` and `@max-[472px]/year:`.

## Owner decisions (defaults this brief builds)

1. **Token names** (Q17). Default: Almanac's names, put in Tailwind's namespaces (`--surface` becomes `--color-surface`, used as `bg-surface`). No estate vocabulary.
2. **Dark mode** (Q18). Default: none. Light only stays.
3. **Visual parity** (Q19). Default: screenshots at 1280 and 390 px, plus 1024 px for the top bar's search field. That width is still unchecked ([wiki/status.md](../../wiki/status.md), "Open"). Every difference is fixed or listed with its reason.
4. **FullCalendar's CSS on the first paint.** Rule 5's one stylesheet moves FullCalendar's 5.4 kB gzip out of the lazy chunk and onto every page, sign-in included. Default: accept it; month is the home view, so most visits load it anyway. The alternative is a second stylesheet for the lazy chunk, as an exception. *New question for the grilling.*
5. **Tailwind's scale against the 15 px root.** Default: `--spacing: 4px`, with the default text, radius, shadow and colour scales cleared, so every utility is in Almanac's pixels. The alternative is to move the 15 px from `:root` to `body` and keep rem-based defaults. No rule anywhere uses `rem`, so it would change nothing visible, but it leaves Tailwind's defaults usable. *New question for the grilling*: any estate app with a non-16 px root meets it.
6. **FullCalendar's CSS in a cascade layer.** Default:
   - `@layer theme, base, fullcalendar, components, utilities;` first in `index.css`;
   - then `@import "@fullcalendar/react/skeleton.css" layer(fullcalendar);` and the same for the Monarch theme.

   The fallback, if a screenshot says the layer breaks something: keep the four overriding rules unlayered after the imports, with a comment. Not a grilling question; the screenshots decide.
7. **Preflight.** Default: Tailwind's preflight, with what `base.css` adds beyond it ported to `@layer base`. The fallback, if FullCalendar or the native controls shift: import Tailwind's `theme.css` and `utilities.css` without its preflight, and keep `base.css`'s resets.
8. **Motion** (rule 7). Default: parity. The seven enter animations become `--animate-*` keyframes in `@theme`, under `motion-safe:`, and there are no new exit animations. Exit animations through `data-ending-style` change what people see, so they are a later call.
9. **Where Almanac falls in the estate's order** (Q20). Default: seventh, after the small apps. This brief doesn't depend on any other app's migration.

## Files you OWN

- `web/src/**/*.css`: all fourteen go.
- `web/src/styles/index.css` and `web/src/lib/cn.ts`, new, with a `cn` test.
- The `className` values in `web/src/**/*.tsx`, including FullCalendar's class-name options in `web/src/calendar/CalendarArea.tsx:236-279`.
- The FullCalendar CSS imports, which move from `CalendarArea.tsx:19-20` to `index.css`.
- The style imports in `web/src/main.tsx`.
- `web/src/calendar/events.ts`: `eventInk()`'s token names, and its tests.
- The ref replacing `.calendar-row__input` in `web/src/calendars/CalendarRow.tsx`.
- The 31 class-name assertions listed above.
- The dependencies:
  - `web/package.json`, all pinned: `tailwindcss` 4.3.5, `@tailwindcss/vite` 4.3.5 (peer `vite` ^8, against Almanac's 8.3.5), `clsx` 2.1.1, `tailwind-merge` 3.7.0;
  - the root devDependencies: `eslint-plugin-better-tailwindcss` 4.10.0 (peer `tailwindcss` ^4.1.17);
  - `package-lock.json`.
- `web/vite.config.ts`: the plugin.
- `eslint.config.js`: the `better-tailwindcss` block only, with `entryPoint: "web/src/styles/index.css"`.
- `web/index.html`: the `theme-color` comment, which names `tokens.css`.
- `scripts/conventions.json`: the calendar-colour exception.
- `.claude/rules/web.md`: the Tailwind lines.
- Corpus:
  - [wiki/decisions.md](../../wiki/decisions.md): the revisits below;
  - [wiki/architecture.md](../../wiki/architecture.md): line 23, "plain CSS with tokens";
  - [wiki/overlays.md](../../wiki/overlays.md): "keeps its own CSS";
  - [wiki/web-app.md](../../wiki/web-app.md): the FullCalendar section;
  - [wiki/status.md](../../wiki/status.md);
  - [log.md](../../log.md).

## Files you must NOT touch

- `server/`, `shared/`.
- Behaviour. That covers:
  - event handlers;
  - FullCalendar's options other than the class-name ones;
  - the wrappers' logic in `web/src/components/ui/` (the Escape guard, `initialFocus`, `finalFocus`);
  - keyboard handling;
  - routes.

  A change that looks necessary for styling is a finding for the outcome note.
- `web/src/components/ui/`'s props. Brief 02 settled them.
- FullCalendar's own CSS files. They're imported, never copied or edited.

## What to do

Follow the skill's `migrating-from-plain-css.md`. One commit per numbered step; after each, `npm run check` and `npm run build` pass.

1. **Screenshots before.** Bring the app up the way [docs/images/shots.md](../../../docs/images/shots.md) does:
   - a scratch `DATA_DIR`;
   - a made-up `demo` user;
   - `docs/images/demo-seed.mjs`;
   - Playwright with Chrome;
   - time zone Europe/Bucharest.

   Two additions:
   - **Freeze the clock** (Playwright's `page.clock`) at one instant, such as 2026-11-11 10:30 in Bucharest. The seed places events around the current week, and the now line and today's disc move.
   - **Copy the seeded data folder**, so the after pass starts from the same rows.

   Keep the images out of git. Take each state at 1280 × 800 and 390 × 844 (Playwright's iPhone 14), plus the top bar at 1024:

   | Area | States |
   |---|---|
   | Sign-in | the login page; a failed sign-in; the "session ended" notice; with "Sign in with Ward" (set `WARD_OIDC_ISSUER` to a dummy); the gate's Loading… and "can't be reached" (stop the API) |
   | Month (`/`) | the default view; a day with "N more"; FullCalendar's "more" popover |
   | Week | with the now line; the all-day row; a selection while quick create is open |
   | Day | the default |
   | Year | sidebar open and closed at 1280 (the container query); the day list popover |
   | Search | the field open (desktop, and the phone's full-bar field); results; no results; the 50-result note |
   | Event | quick create (desktop); the form for a new event and an edit; "Custom days…" open; the time list open; a validation error; all-day on; the details popover for a one-off with a link and for a series; the edit-scope dialog with and without "This event" |
   | Calendars | the list with a row under the pointer; the row menu; the colour palette; renaming; New calendar; Delete calendar, and its "Only calendar" state |
   | Account | the account menu; Time zone (with a search and with no match); Change password, with an error; Notifications, in each state you can reach (off, on, blocked, not set up) |
   | Shell | the sidebar collapsed (desktop); the drawer, the view menu, the Today icon and the round Create button (phone); a toast with Undo; a keyboard focus ring; the skip link focused |

   Record the built CSS size, raw and gzip, of the main chunk and the lazy chunk.
2. **Set up.**
   - Add the dependencies and `@tailwindcss/vite`.
   - Write `web/src/styles/index.css`:
     - the layer order (decision 6);
     - `@import "tailwindcss"`;
     - the FullCalendar imports in `layer(fullcalendar)`;
     - `@theme` with the default namespaces cleared and the 117 tokens mapped;
     - `--spacing: 4px` (decision 5).
   - Keep `tokens.css`, but **as aliases only**, such as `--surface: var(--color-surface)`, so the files not yet migrated keep working.
   - Add `web/src/lib/cn.ts`.
   - Move the two FullCalendar imports out of `CalendarArea.tsx`.
3. **Migrate one stylesheet at a time**, in this order, deleting each when it is empty:
   1. `web/src/styles/base.css`: preflight plus `@layer base` (decision 7). `.visually-hidden` becomes `sr-only`.
   2. `web/src/styles/components.css`, together with `web/src/auth/auth.css`'s field and error sections and `web/src/components/Field.tsx`:
      - Button, with its variant map as one `buttonClass()` that `Menu`'s `triggerClassName` callers use;
      - the icon button;
      - the Dialog, Menu, Popover and Toast parts in `web/src/components/ui/`, with state variants (`data-highlighted:`, `data-disabled:`, `data-checked:`) and the positioner variables (`origin-(--transform-origin)`);
      - MonthGrid.

      This goes before the shell, unlike the estate draft, because the shell's buttons are these.
   3. `web/src/styles/shell.css` and `web/src/account/account.css`. The notice's error state extends the shell's notice. `.shell--phone` and `.topbar--compact` become conditional classes, or a `data-phone` attribute with a `group-data-phone:` variant.
   4. The rest of `web/src/auth/auth.css`: the gate and the login page.
   5. `web/src/account/time-zone.css` and `web/src/push/notifications.css`, with the `Switch` wrapper.
   6. `web/src/calendars/calendars.css`.
   7. `web/src/search/search.css`.
   8. `web/src/event/details.css` and `web/src/event/editor.css`. The editor's phone sizes go here.
   9. `web/src/year/year.css`.
   10. `web/src/calendar/calendar.css`, last: the options' utilities, the markers kept, the palette into `@layer base`.
   11. `web/src/styles/tokens.css`, the aliases: delete it once nothing reads an old name (`grep -rn "var(--" web/src` shows only `--color-*`-style names, `--calendar-color`, `--swatch`, the positioner variables and `--fc-monarch-*`).
4. **Lint.** Turn on `better-tailwindcss`'s correctness rules and its class order as errors, and fix what they find.
5. **Screenshots after.**
   - Take the same states again from the copied data folder and the same frozen clock.
   - Compare each pair pixel by pixel, with Playwright's comparison or pixelmatch at its default threshold.
   - Fix every difference, or list it in the outcome note with its reason.
   - Expected: hover not sticking after a tap on a phone. Record the CSS sizes.
6. **Corpus.**
   - In [wiki/decisions.md](../../wiki/decisions.md), revisit these by heading, each with a dated line and a `log.md` entry:
     - **"Base UI under the dialogs, popovers, menus and drawer"**: it says "styled by Almanac's own CSS", and rejected shadcn "which brings Tailwind, which Almanac doesn't use". Both change. The wrappers are now styled with Tailwind, by the owner's call of 2026-11-09. shadcn stays rejected, for a reason of its own to record: Base UI is used directly, without a styled kit on top.
     - **"FullCalendar v7 draws day, week and month; the year view is our own"**: it rejected ilamy-calendar as needing Tailwind and having one maintainer. Note that the Tailwind half no longer applies and the choice stands on the other half. The choice itself isn't reopened.
     - **"Google Calendar's layout, light only"**: unchanged. Add that the Tailwind setup has no dark variant because of it.
     - The page's `summary:` line, which says "Base UI under the dialogs, popovers and menus".
   - Update [wiki/architecture.md](../../wiki/architecture.md), [wiki/overlays.md](../../wiki/overlays.md), [wiki/web-app.md](../../wiki/web-app.md) (the palette is in `index.css`, the overrides are utilities through the class-name options, the markers stay), [wiki/status.md](../../wiki/status.md) and [log.md](../../log.md).
   - Add to `.claude/rules/web.md`:
     - tokens only from `@theme`;
     - no arbitrary colours;
     - calendar colours through `--calendar-color`;
     - FullCalendar styled through its options;
     - the two markers kept.
   - Run `bash corpus/lint.sh --index`, then `bash corpus/lint.sh`, until it is clean.
7. **The gate.** Drop `check-base-ui`'s `--warn-only` from `check:conventions`.

## Acceptance

- [ ] `find web/src -name '*.css'` prints only `web/src/styles/index.css`, and it holds the FullCalendar imports. `CalendarArea.tsx` imports no CSS.
- [ ] `check-base-ui` passes **strict**, with only the calendar-colour exception and brief 02's `ColorPicker` one in `scripts/conventions.json`.
- [ ] `grep -rnE "(bg|text|border|fill|stroke|ring|outline|shadow)-\[(#|rgb|hsl)" web/src` prints nothing.
- [ ] `index.css`'s `@theme` defines exactly the mapped tokens. The default colour, text, radius and shadow scales are cleared: `bg-red-500` or `text-sm` in a component produces no CSS.
- [ ] A `cn` test proves `cn("text-ink", "text-body")` keeps both classes.
- [ ] The screenshot pairs match, with every difference listed and explained in the outcome note, alongside the before and after CSS sizes.
- [ ] `npm run check` (with `better-tailwindcss`) and `npm run build` pass, and so do the 31 rewritten assertions.
- [ ] The three decisions are revisited in [wiki/decisions.md](../../wiki/decisions.md), with a `log.md` entry. `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 02's renamed CSS rules for the new wrappers (toast, radio group, toggle group, confirm, switch) are migrated here like any other.
- Brief 04 doesn't touch `web/`. If both are open at once, they conflict only in `package-lock.json`, so don't run them at the same time.
