fix

# almanac: critique of "The week and its day" (full build, 2026-11-12)

Read from the shots, then re-rendered headless at the real first viewports (1280x800, 390x844, 360x800) because `shoot.mjs` grows the viewport to the page height (1034, 1465 and 959 px frames beside today's 800 and 844). Judge the folds from those renders, not the board frames. Rulings 1-7 in `judge/almanac/RESULT.md` stand. Where a finding clashes with one, I say so.

## First-screen density, today against the build

| | Today | Build |
|---|---|---|
| 1280x800 week: hours | 08:00 to about 20:30 (48 px/h, 08:00 line at y 199) | 08:00 to about 18:55 (56 px/h, 08:00 line at y 188) |
| 1280x800 week: events | 15 blocks: 13 whole, Dinner with Alex and Read cut but titled | 13 whole; Dinner with Alex (top 806) and Read (top 862) entirely below the fold |
| 1280x800 week: days | 7 | 7 |
| 1280x800 left column | Create, mini-month, all 4 calendars (to y 540) | Create, mini-month, day card; My calendars card starts at y 784, no toggle visible |
| 1280x800 event form | whole dialog, Save at y 667 | dialog 72-939, Save, Cancel and Delete at about y 905, off screen |
| 390x844 week | 7 days, 08:00 to about 21:50, 16 blocks (15 timed + Anniversary), 2 titles uncut (Yoga, Read) | strip of 7 with ticks; Wed whole (5 events + now rule), Thu's 3 events, the third beside Create; Fri to Sun below |

On the phone the first screen drops from 7 days to 2. That cost is ruling 5's and I'm not asking for the grid back: in exchange every visible title is whole. The builder's share of the phone cost is the 56 px row pitch (issue 4). The desktop losses are the builder's.

## Regressions against today

1. **Week 1280: 1.6 hours lost at the fold.** The chrome is not the cause (08:00 sits 11 px higher than today); `--height-hour` is 56 px against today's 48 and the direction's 52. Cost: about 90 px, and the evening (Dinner with Alex, Read) leaves the first screen. Fix: `--height-hour: 48px`, which puts 20:30 at about y 787, today's fold. Then trim the day head from 69 to 56 px (weekday 12/16 over the numeral at 20/24, padding 8) so 21:00 lands at about y 798: Read and Dinner with Alex are whole and all 15 events of the week fit the first screen. A 45-minute block is then 34 px (blocks sit 2 px inside their slot): exactly two lines of 18 + 16 with nothing spare, so the 11/14 time line in issue 3 becomes a condition of this pitch. The direction's 52 px doesn't get there (21:00 near y 840 even with a one-line head). Do not shorten titles to win it back.
2. **Week 1280: My calendars below the fold.** The four checkboxes are a filter people use while looking at the grid. Today they sit at y 377-540; now the card starts at y 784. This follows from ruling 2's order (the day card between the mini-month and My calendars), so I'm flagging it as a clash. Height to buy back inside the order: the "Today" chip onto the heading's line as the phone already does (-28 px); day-card rows 39 → 32 px (-35); mini-month cells 32 → 28 px (-24) and card padding 16 → 12 (-16); gaps between cards 16 → 12 (-12). That is about 115 px and brings the My calendars head and two rows above 800, no more. The column also has to scroll on its own, sticky under the header band, not with the page. If the controller wants all four calendars visible on the first screen, the one honest option is My calendars above the day card. That is the controller's call, not the builder's. Capping the day card's rows would hide events and isn't an option.
3. **Event form 1280: Save is unreachable.** `.dlg` is `position:fixed; top:72px` with no `max-height` and no scroll, 867 px tall in an 800 px window. Today's form is 608 px tall and fully visible. Fix: `max-height: calc(100dvh - 32px)`, the body scrolls, the footer (Delete, Cancel, Save) is sticky with a hairline above. Then bring it under 800 anyway: Reminder and Repeat side by side in one row (-80 px), field height 44 → 40 (-28), group gap 16 → 12 (-28). That gives about 730 px. Keep the visible labels; they are an improvement on today. The phone form has the same growth (959 px against today's 844, so 115 px of scroll), but its footer is sticky (763-844) and Save stays reachable. Field height 40 and gaps 12 there bring it to about 880 px; the labels are worth the rest.
4. **Below 1100 the column becomes the drawer** (ruling 2). Today the mini-month and My calendars stay on screen down to 768 px. At 1024 they now sit behind the menu button. It's a ruling, so this is only a note for the owner's sticky.

## Priority issues

1. **Event form 1280 has no reachable Save** (regression 3). It blocks the screen's only job.
2. **Hour pitch costs the evening at 1280** (regression 1). `--height-hour` back to 48.
3. **Event times hidden by a viewport band, not by fit (ruling 4).** `@container page (min-width:1100px) and (max-width:1269px)` and `(760-959px)` hide `.tm` on every one-line block. I measured title + gap + time + padding against each block's width:
   - At 1269 all eight one-line blocks fit (Team standup needs 117 px and has 120) and all eight lose their time anyway.
   - At 1100 (96 px blocks), Groceries (90) and Call home (93) fit. One to one (98) and Groceries are 40 px tall, so they have room for a second line.
   - The twin's page scrolls (height 1034 at 800), so a 1280 window with a classic 15-17 px scrollbar measures 1263-1265 and drops the times on the "1280" design itself.

   The title-only fallback is acceptable under ruling 4 only for a block that can't hold both. What I'd do: decide per block, not per viewport. Give each block a fit check (a ResizeObserver from FullCalendar's `eventDidMount`, setting `.no-time` when title + time overflow). Blocks of 45 minutes or more put the time on a second line instead of dropping it. Set the time in Sofia Sans Condensed 11/14 with a 4 px gap to widen the band where both fit. Then only the 30-minute Team standups go title-only, and only below about 1240.
4. **Phone rows are loose.** Each one-line agenda row is 56 px for 22 px of text. Rows at 48 px (Android's touch minimum), the card head 48 → 40 and card gaps 10 → 8 recover about 80 px. Thursday's card then sits whole above Create, and Friday's head shows: about a third of a day more on the first screen, with nothing cut.
5. **Create covers a title at rest on 360 px Android.** At 360x800 the extended Create (x 233-344, y 652-704) sits over Thursday's "Team standup" before any scroll. At 390 it clears Release check by about 3 px. Ruling 5 (extended Create) and ruling 6 (nothing covers content) clash here, so this one is the controller's. With the 48 px rows from issue 4, 390 is clear at rest, but at 360 Release check moves to about y 646-668, still under Create. A collapse on scroll doesn't help, because the overlap is at rest. My proposal: below 380 px wide, Create is the 56 px round icon button at rest (accessible name Create, x 288-344), which clears every title; 380 and up keeps the extended button.
6. **Ground stops short at 768.** At 768x1024 there's a white band from y 984 down, in dark too, because `html` and `body` have no background. Fix: `html { background: var(--color-ground) }` and the shell at `min-height: 100dvh`.
7. **Phone account disc.** The disc fills its whole 44x44 target, grey in light and a black hole with a ring in dark. It's heavier than the search and today icons beside it and bigger than the 36 px desktop disc. Draw a 32 px disc on `accent-tint` with an `accent-ink` initial inside the 44 px target.

Minor: the 1280 popover's top edge (y 322) slices through "One to one 10:00" (302-342), so the title reads as half-cut. Align the popover's top with the selected event's top (y 358).

Board frames: have `shoot.mjs` capture the folds at the real viewport too (1280x800, 390x844), and make the 1280 twin viewport-fit (the grid card is `100dvh` minus the header, and its body scrolls under sticky day heads and all-day row, as FullCalendar does today). Right now the day heads scroll away with the page.

## Strengths to keep

- **Islands.** The header band, three cards in the left column and the grid card on ground. They separate in both themes (surface on ground 1.17 / 1.20 plus a hairline). The owner asked for exactly this, and today is one flat sheet.
- **No title is cut anywhere.** "Team standup 09:30" is whole at 1280, "Dinner with Alex" wraps at narrow widths, and the phone agenda has every title. Judges' G3 is met.
- **The day card's 10:30 rule beside the grid's 10:30 chip.** It shows "what's next" with no click, and it lists Run, which is above the grid's window. The phone strip's ticks show the week's shape the same way.
- **The phone is a phone design.** Sticky strip, one column, a bottom view bar in thumb reach, a bottom sheet for details with 48 px buttons, a sticky form footer. Dark has its own work too: lighter surfaces lift the cards, the moss lightens, event fills turn light with dark text.

## Heuristic scores (29/40, Good)

1. Visibility of system status, 3: the now line, 10:30 chip, lit today column and week band are strong; the 1280 form hides its Save.
2. Match with the real world, 4: 24-hour times, Monday-first weeks, the calendar grammar kept.
3. User control and freedom, 3: close, Cancel and Esc are present; Delete sits left and apart.
4. Consistency and standards, 3: times come and go by viewport band; the disc differs between phone and desktop.
5. Error prevention, 3: Delete carries the danger colour and a label; Save is disabled while saving; recurrence edit scope isn't drawn.
6. Recognition over recall, 3: visible field labels, the strip ticks; calendar toggles are off the first desktop screen.
7. Flexibility and efficiency, 3: mini-month jumps, strip chips, routes and shortcuts kept.
8. Aesthetic and minimalist design, 3: specific and calm, but loose phone rows and an 867 px form.
9. Error recovery, 3: the direction sheet's states say what failed and offer the next step ("The end must be after the start.", "The week didn't load" with Try again); none are drawn on the screens themselves.
10. Help and documentation, 1: no comp has a help or shortcut-list entry point.

Cognitive load: low, one checklist failure (single focus on the 1280 form, which needs a scroll to finish).

Design specificity: its own. Condensed numerals, moss on olive greys, and the day list beside the week would not pass unchanged as another calendar's UI.

## Detector (`detect.mjs --json`, full parser, 9 twins)

- `cramped-padding` (7 per week twin): `.al` root, `.seg` switcher, `.grid` card, `.ga` gutter, `.col` columns, `.strip`. All dismissed: a time grid is flush by design, and a compact segmented switch is the known false positive.
- `flat-type-hierarchy` (12-22 px, 1.8:1): dismissed for a dense app screen. The period title and card heads carry the hierarchy through weight and the condensed face.
- `clipped-overflow-container` (html/body, details twins): dismissed. `overflow-x: clip` on body doesn't cut the fixed popover in any render.
- `gpt-thin-border-wide-shadow` (light dialog and popover): dismissed. A floating layer gets a hairline and a 28 px blur.
- Direction sheet: `em-dash-overuse` (48, sheet prose), `tight-leading` 1.23 on specimens, `repeated-container-text` on the specimen panel. None of these is in the app.

Keep the islands and the whole titles while fixing: buy height from the hour pitch, padding and row rhythm, never from cards or text.
