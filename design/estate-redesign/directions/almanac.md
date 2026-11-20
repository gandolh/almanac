# almanac: two directions

Written 2026-11-12 by the art director. Repo: almanac, brief 05. Recorded limits both directions keep: the four views (day, week, month, year), the left column's contents (Create, the mini-month, My calendars), the phone drawer, the glossary's words (calendar, event, view, quick create, event form), 24-hour times, Monday-first weeks, routes and shortcuts. A calendar's colour stays data: the store keeps the key (`blue`, `green`, …). The brief's "two-line grammar of the glossary" appears nowhere in the wiki, so read it as an event's two lines (title, then time) plus the glossary's words.

Today copies Google Calendar: the palette (`#0b57d0`, `#1f1f1f`, `#dadce0`, Google's dark set), Roboto, Google's level shadows and the calendar shades in `shared/src/calendar.ts`. Both directions replace all of it. The Google details both drop, with their replacements:
- tracked-capital weekday heads ("MON"): sentence case, "Mon 9" (Floor 9);
- the filled round today disc: a rounded-square date tab;
- the shadowed white Create pill: a flat, labelled accent button;
- the red now dot and line: each direction's own now mark, with no dot;
- the 64 px bar and 256 px column: new metrics;
- the date-glyph logo: a type wordmark;
- white text on mid-tone event fills (white on green is 2.6:1 today): the shared event colours below;
- the popover's middle-dot date line (Floor 10).

## 1. Today's strengths (keep all of them)

1. The calendar grammar is all in view: Today, ‹ › and the period title side by side, and the four views always on screen as labelled choices (a menu on the phone).
2. Create is the one primary action, always one press away, in thumb reach on the phone.
3. The date tools are grouped under their own heads: the mini-month to jump, and My calendars, each calendar with its colour checkbox and a "+".
4. The week grid reads at a glance: an hour gutter, an all-day row apart from the timed grid, today's column marked in its head, and a now line across today.
5. One colour per calendar runs from the checkbox to every event, so Work and Home are told apart without reading.
6. The time grid gets most of the screen, under thin lines and little chrome; search and the account stay one tap away.

Today has no surfaces: the ground and every panel are the same white, and only hairlines split the bar, the column and the grid. Don't keep that. Each skeleton below says what is raised, because G1 is judged first.

## 2. The main screen

The week view with its shell, route `/week/2026/11/11`, clock frozen at Wed 11 Nov 2026 10:30. Today's shots: `light-1280-week.png` and `light-390-week.png` (dark: `dark-1280-week.png`, `dark-390-week.png`) in `board/shots/almanac/`. The grid opens scrolled to 07:45, as FullCalendar does today, so every sketch starts its window at the same hour; how far down it reaches depends on the direction's hour height.

## 3. The content fixture (from the shots and the capture's seed, with full strings where the shot cuts them)

**1280 shell.** Bar: menu button, wordmark `Almanac`, `Today`, ‹ ›, title `9 – 15 Nov 2026`, search button, switcher `Day` `Week` `Month` `Year` (Week chosen), account disc `T`. Left column: `Create`; then the mini-month `November 2026` with ‹ ›, heads `M T W T F S S`, rows 26 27 28 29 30 31 1 / 2–8 / 9–15 / 16–22 / 23–29 / 30 1 2 3 4 5 6 (October's and December's days muted, 11 is today); then `My calendars` with a `+` and four checked rows: `Personal` (blue), `Work` (green), `Home` (orange), `Fitness` (purple).

**The grid.** Day heads `Mon 9`, `Tue 10`, `Wed 11` (today), `Thu 12`, `Fri 13`, `Sat 14`, `Sun 15`. The `All day` row holds `Anniversary` on Thu (Home). Hours `08:00` to `20:00` in 30-minute slots. The now line is on Wed at 10:30.

| Day | Event | Time | Calendar |
|---|---|---|---|
| Mon 9 | Team standup / Planning | 09:30 – 10:00 / 14:00 – 15:30 | Work / Work |
| Tue 10 | Dentist / Team standup | 08:30 – 09:30 / 09:30 – 10:00 | Home / Work |
| Wed 11 | Run (above the window: in lists only) | 07:00 – 07:45 | Fitness |
| Wed 11 | Team standup / Design review (`Room 2`) | 09:30 – 10:00 / 11:00 – 12:00 | Work / Work |
| Wed 11 | Groceries / Read | 17:30 – 18:15 / 20:00 – 21:00 | Home / Personal |
| Thu 12 | Team standup / Release check | 09:30 – 10:00 / 15:00 – 16:00 | Work / Work |
| Fri 13 | Run (above the window) / Team standup | 07:00 – 07:45 / 09:30 – 10:00 | Fitness / Work |
| Fri 13 | One to one / Dinner with Alex (`Corner bistro`) | 10:00 – 10:45 / 19:00 – 21:00 | Work / Home |
| Sat 14 | Yoga | 10:00 – 11:00 | Fitness |
| Sun 15 | Call home | 18:00 – 18:30 | Personal |

The Run series repeats Mon, Wed and Fri from Tue 10. recurrence.md moves a series' start to its first matching day, so Run falls on Wed 11 and Fri 13, not Mon 9.

**390.** The bar holds the menu button, `Nov 2026`, search, the today button showing `11`, the view menu `Week` and the disc `T`. It has no ‹ ›: a sideways swipe steps the view. Create is the round button (accessible name `Create`). The grid has the same events.

**Text rule, both directions:** no ellipsis, nothing clipped, titles break only between words. An event of 60 minutes or more shows two lines: the title, then `HH:MM – HH:MM`. A shorter one (30 or 45 minutes, as today's shot does) shows one line, the title then its start time, or the title alone when both don't fit. Each direction's 390 rule is in its section.

**Event colours, shared by both directions** (new values, not Google's; text on each fill is at least 5.6:1):

| Key | Light: solid / tint / text on tint (text on solid `#ffffff`) | Dark: solid / text on solid / tint / text on tint |
|---|---|---|
| blue | `#2863ab` / `#d6ecff` / `#144073` | `#8dc1ff` / `#0d1b2d` / `#1f3959` / `#d1e7ff` |
| green | `#137738` / `#d5f3da` / `#034e21` | `#89d298` / `#0b2010` / `#1c4125` / `#d0eed5` |
| orange | `#9d4616` / `#ffe1d1` / `#692a06` | `#f9a782` / `#2a140a` / `#532c1a` / `#ffdccc` |
| purple | `#7f4995` / `#f5e1ff` / `#532d63` | `#d9a8ef` / `#221527` / `#452d4f` / `#f0dcfa` |

- **The other six keys,** by the same OKLCH recipe:
  - light: solid (0.50, 0.13, h), tint (0.935, 0.045, h), text on tint (0.37, 0.10, h);
  - dark: solid (0.80, 0.11, h), text on solid (0.22, 0.04, h), tint (0.34, 0.065, h), text on tint (0.92, 0.045, h);
  - hues: teal 195, olive 120, yellow 90, red 25, pink 0, graphite 260 at chroma 0.01.
- **Edges:** a tint sits only 1.19–1.41:1 from the surface, so a tinted event always carries a full 1 px solid edge (4.7:1 or more). Never a side stripe.

## 4. Directions

**Palettes by role.** A uses cool slate neutrals; B uses olive-tinted neutrals. Each pair is light / dark.

| Role | A light | A dark | B light | B dark |
|---|---|---|---|---|
| ground | `#eceff5` | `#12161b` | `#edede8` | `#11110d` |
| surface | `#ffffff` | `#22262d` | `#ffffff` | `#22231e` |
| surface-sunk | `#e3e8ee` | `#0c0f13` | `#e4e4de` | `#090907` |
| ink / ink-muted | `#161e2c` / `#565e6a` | `#e5e8ed` / `#a9aeb7` | `#1a1b14` / `#5d5f56` | `#eaeae4` / `#abaca3` |
| line / outline | `#d3d8de` / `#79818b` | `#3b4048` / `#7c848f` | `#d6d6cf` / `#808178` | `#3f3f38` / `#808178` |
| accent / on-accent | `#2f4693` / `#ffffff` (ultramarine) | `#b2bfec` / `#161c3b` | `#516312` / `#ffffff` (moss) | `#bdd18f` / `#192003` |
| accent-tint / accent-ink | `#dee8ff` / `#22336b` | `#303957` / `#dde4f9` | `#e4efce` / `#344106` | `#333c1e` / `#e2eec9` |
| now | the accent | the accent | `#c1351e` (vermilion) | `#fa8467` |
| danger | `#b63325` | `#f58d7c` | `#b02a2d` | `#f47a79` |

**Pre-checked contrast** (WCAG 2), light / dark. The sketchers re-run `contrast.mjs`.
- **A:** surface on ground 1.15 / 1.20; line on surface 1.43 / 1.46; outline on surface 3.94 / 4.02; muted on ground 5.69 / 8.15; accent on surface 8.68 / 8.36. The ultramarine sits at HSL 226°, clear of shelfmark's teal (192°), atrium's denim (215°) and Google's azure (217°).
- **B:** surface on ground 1.17 / 1.20; line on surface 1.46 / 1.49; outline on surface 3.94 / 4.02; accent on surface 6.68 / 9.55; now on surface 5.53 / 6.45.

### A. Ultramarine week (Evolve today)
- **Idea:** today's calendar, with its own ink and its own surfaces. The bar, the column and the grid each become a distinct island, and today's column stays lit from head to foot.
- **Skeleton at 1280:**
  - The bar: 56 px on `surface`, full width, with a 1 px `line` under it, holding today's items in today's order.
  - The column: 264 px on `ground`. `Create` spans it: 44 px, accent fill, radius 10, a plus icon and the label, no shadow. Below it, the mini-month in its own card, with the shown week 9–15 banded in `accent-tint`. Then My calendars in a second card.
  - The grid: one raised card, radius 12, with a `line` edge and a level-1 shadow in light. It holds the day heads, then the all-day row as a `surface-sunk` band, then the timed grid at 48 px per hour.
  - Events: tint fill, 1 px solid edge, text on tint, radius 6.
- **Skeleton at 390:**
  - The bar holds today's items in today's order, on `ground`.
  - The grid card sits 8 px in from the sides, with radius 12 at the top and its `line` edge, so ground shows around it. Its day heads are sticky.
  - The week scrolls sideways inside the card, snapping per day, with about 104 px columns and the hour gutter pinned. It opens on Wed 11, with Thu and Fri whole and Sat peeking in, at 56 px per hour. Events of 60 minutes or more take two lines; shorter ones take one line, the title alone.
  - The swipe that steps the week moves to the bar and the head row.
  - Create: a 56 px rounded-square accent button, 16 px above the gesture area.
- **Type:**
  - Manrope 400/500/600/700 for the UI, with tabular figures.
  - Castoro 400 for the wordmark (22/28) and the period title (24/30). If Castoro's figures don't line up, set the title's figures in Manrope.
  - Scale: 12/16 for the hours and event times; 13/18 for event titles and the mini-month; 14/20 for controls and the column's rows; 16/24 for the phone's body. A day head is "Mon" at 12/16 `ink-muted` over the date at 20/24, weight 600.
- **Signature, the lit day:** today's whole column carries an `accent-tint` wash at about 40%. Its date sits in an accent rounded-square tab (radius 8). The now line is 2 px of accent across today's column only, with a `10:30` chip in the hour gutter and no dot.
- **Reference:** `notion`, for pastel tints keyed to property colours, with the text in the tint's own dark tone (the event treatment). Nothing of its palette or type.
- **Reopens:**
  - index.css's "Google Calendar's look, played straight" (the look changes; decisions.md's layout stays);
  - decisions.md's "calendar colours… look the same in both themes", and `eventInk`'s white or dark text;
  - web-app.md's phone swipe, which leaves the grid body. Open: with the body scrolling sideways, the phone needs a visible way to step the week (the board decides);
  - the Google shades in `shared/src/calendar.ts`. Brief 05 may not touch `shared/`, so the web maps each key to its own tokens; flag the shared file for a later brief.

### B. The week and its day
- **Idea:** the week grid shows where the time goes, and beside it the chosen day reads as a list, with the now mark in both. On the phone the day leads, under a strip of the week.
- **Skeleton at 1280:**
  - The rail: 80 px on `surface` with a `line` edge, holding the wordmark, then `Day` `Week` `Month` `Year` as labelled rail items (icon over word). Week is chosen with an `accent-tint` pill.
  - The header band: 56 px, raised, over the rest. It holds `Today`, ‹ › and `9 – 15 Nov 2026`, then at the right an open search field, `Create` (a labelled accent button) and the disc `T`. No menu button at this width.
  - The grid: a raised card on `ground` (radius 12, columns about 113 px, 52 px per hour). Events are solid fills with text on solid, radius 6.
  - The pane: 304 px, three cards. Run, `Room 2`, the date heading and `10:30` are real seed fields and the frozen clock, shown on purpose. First the mini-month, with the shown week banded and today marked. Then `Wednesday, 11 November` (the details popover's date format), listing Run, Team standup, a `10:30` now rule, Design review with `Room 2` under it, Groceries and Read; each row shows the time range, a calendar mark and the title. Then My calendars.
  - The pane scrolls on its own, and under 1100 px it folds into the drawer.
- **Skeleton at 390:**
  - The top bar: the menu button (the drawer keeps the mini-month and My calendars), `Nov 2026`, search, the today button `11` and `T`.
  - A sticky strip of seven day chips, `Mon` over `9` through `Sun` over `15`. Each chip carries a 4 px tick per event in its calendar's solid colour, Run and Anniversary included: Mon 2, Tue 2, Wed 5, Thu 3, Fri 4, Sat 1, Sun 1. Wed 11 is chosen, in an accent fill.
  - Under the strip, one card, `Wednesday, 11 November`, with the day's rows and the `10:30` now rule. Titles wrap and are never cut.
  - A bottom navigation bar, `Day` `Week` `Month` `Year`, 64 px plus the gesture inset, replaces the `Week` menu.
  - An extended `Create` button (plus and label) sits above the bar at the right. The list pads by both heights.
- **Type:**
  - Sofia Sans 400/500/600/700 for the UI.
  - Sofia Sans Condensed 500/600 for every date and time (hours, day numbers, time ranges) and 700 for the wordmark, with tabular figures.
  - Scale: 12/16 for the hours; 13/18 for event titles; 14/20 for the UI and list rows at 1280; 16/22 for list titles at 390; 18/24 for card heads; 22/26 for the strip's and the heads' date numerals.
- **Signature, the day beside the week:** the chosen day's list, with its now rule mirroring the grid's now line, so "what's next" never needs a click. On the phone, the strip's ticks give each day its shape.
- **Colour use:** the moss is yellow-green, not satchel's inbox green; the controller rules on that. It sits 30° of hue from the green Work events and shares its hue with the `olive` calendar key, so it marks only the chosen view and day, Create, links and focus. Danger always carries a label.
- **Reference:** `cal`, for its booking page's move: a date picker beside the chosen day's list. Nothing of its palette or type.
- **Reopens:**
  - all of A's except the swipe;
  - the left column moves: the views go to a rail, the date tools to a right pane;
  - on the phone, the `Week` menu becomes a bottom bar, and the week view becomes a strip plus a day list (the time grid stays in Day). This touches features.md's "the views fill the screen" and web-app.md's phone shell;
  - the day pane is new UI, built from the year view's existing day list (`DayList.tsx`).

## 5. Registry lines

| almanac (A) | Ultramarine week | Castoro (wordmark, period title) | Manrope | ultramarine (today's blue family, new value, HSL 226°) | 56 px bar; a left column of Create, a mini-month card and a calendars card; the week grid as one raised card with today lit; phone: the grid scrolls sideways by day |
| almanac (B) | The week and its day | Sofia Sans Condensed (dates, times, wordmark) | Sofia Sans | moss (yellow-green, HSL ~75°; not satchel's green) | 80 px view rail; header band with Create; grid card; right pane of mini-month, day list and calendars; phone: day strip over the day list, bottom view bar |
