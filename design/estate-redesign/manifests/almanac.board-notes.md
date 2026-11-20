# The board's notes: Almanac

The estate redesign board is a private canvas. This file copies what its page for this app said beside the screens: the owner's asks, the decisions, the rules the design reopened, the open questions and the Floor. The owner's answers are in [README.md](../README.md#the-owners-decisions).

## Asks to the owner

- 1. Reopened: Almanac stops copying Google Calendar's look (decisions.md, "Google Calendar's layout") and takes a moss accent, olive greys and Sofia Sans. The layout stays. OK? 2. Calendar colours differ per theme, with dark text on the light dark-mode fills (reopens "look the same in both themes" and shared/src/calendar.ts; the web maps keys to its own tokens, shared/ is a later brief). OK? 3. Approve The week and its day as Almanac's direction? (beside `almanac-direction`)

## Decisions

- No view rail: the Day Week Month Year switch sits in the header, as today, with a menu button that still opens and closes the left column (web-app.md: its open state is remembered). Under 1100 the column is the drawer and the switch drops to a row under the header. (beside `almanac-proposed-week-1280`)
- Create stays a labelled, full-width button at the head of the left column, flat and moss, where today's pill sits. (beside `almanac-proposed-week-1280`)
- The chosen day is a list in the column, below the mini-month and My calendars (the recorded order), the column scrolling on its own under the header band, with its own 10:30 now rule mirroring the grid's now line; "what's next" needs no click. Run, at 07:00, is above the grid's window and lives only here. (beside `almanac-proposed-week-1280`)
- Event blocks are solid fills with text on solid. Every block, a 30-minute standup included, shows its start time; a 45-minute block puts the time on a second line, and only a block too narrow for both (a 30-minute one under about 120 px wide) shows the title alone, with the full row in the details. Nothing is cut with an ellipsis. (beside `almanac-proposed-week-1280`)
- Today's numeral is light ink on the moss in the mini-month, the week head and the phone strip (6.7:1 light, 10.2:1 dark); the sketch's dark-on-moss numeral was the judges' one desktop loss. (beside `almanac-proposed-week-1280`)
- The strip's seven chips carry a tick per event in the calendar's colour (Wed 5, Fri 4); tapping a chip scrolls to its day and marks it chosen. Mon 9 and Tue 10 sit above Wednesday in the same list and are not drawn. (beside `almanac-proposed-week-390`)
- Scrolled to the end, the last row sits 32 px clear of Create, which sits 16 px above the view bar; the list pads by both bars and the gesture inset. Sun 15 is the chosen day. (beside `almanac-proposed-week-scrolled-390`)
- Sofia Sans and Sofia Sans Condensed replace Roboto, which was Google Calendar's face; both are on Google Fonts [conv]. Condensed carries every date and time, with tabular figures. (beside `almanac-direction`)
- The popover's date line drops the middle dot (Hallmark gate): the date, then the time on its own line. Delete is a labelled danger button, Edit an outlined one; on the phone the same card is a bottom sheet with 48 px buttons. (beside `almanac-proposed-event-details-1280`)

## Reopened rules

- Recorded (decisions.md, 2026-10-16): "The UI copies Google's layout straight, with no design" and the calendar colours "look the same in both themes, so the text on an event is fixed." Proposed: the layout stays, the look is Almanac's own, and the text on an event is white on the light solids and near-black on the dark ones. (beside `almanac-direction`)

## Open questions

- On the phone the week becomes a day strip plus an agenda that runs through Sunday; the time grid stays in Day. The bottom view bar replaces the Week menu. Both reopen web-app.md's phone shell. Keep both? (beside `almanac-proposed-week-390`)
- The moss accent shares its hue with the olive calendar key. The accent marks only the chosen view and day, Create, links and focus, never an event. Keep, or move the accent? (beside `almanac-direction`)

## The Floor

- Contrast is scripted over 35 pairs: text min 5.08 light and 5.07 dark, edges and icons 3.09 and 4.02, focus rings and cards (1.17 and 1.20 against the page, plus a 1.46 edge) all pass. No overflow at 1280, 1100, 1024, 768, 390 or 360 in either theme, and no control spills its box. Phone targets are 44 to 56 px, the strip's chips 76. First screen at 1280x800: the grid runs 08:00 to 21:00 with all 15 events whole, the four calendars are visible and the form's Save is at y 602. At 390x844 and 360x800 Wednesday and Thursday are whole and Friday starts; under 380 px Create is a 56 px round button. Sloplint --scope app gives 0 FAIL on all four Proposed twins; the 24b, 72 and 39b reflexes are waived with reasons and the repeated-times warning is the grid and the day list showing the same events. The direction sheet draws empty, loading and error states for week, details and form. (beside `almanac-direction`)

## Other notes

- Drawn in edit mode with Design review, as today's shot shows, since that shows every field. Opened from Create it is the same form with an empty title and no Delete. Field labels are visible above each field; times are 24-hour text.
- Ranges keep the app's format (9 ‒ 15 Nov 2026, 09:30 ‒ 10:00) but are set with the figure dash U+2012, which looks like the en dash: Hallmark gate 19 fails on U+2013 and cannot be waived. The states on the direction sheet other than the end and save errors and Event deleted are proposals, not today's strings.
- Handoff: manifests/almanac.tokens.css and almanac.tokens-map.md carry the tokens in the app's own names.

## Contrast, as measured

| Pair | Light | Dark | Needs |
|---|---|---|---|
| ink on ground | 14.77 | 15.67 | 4.5 |
| ink on surface | 17.02 | 13.1 | 4.5 |
| ink on sunk (search, all-day row) | 13.59 | 16.5 | 4.5 |
| ink on accent-tint | 14.48 | 9.63 | 4.5 |
| muted on ground | 5.52 | 8.25 | 4.5 |
| muted on surface (hours, weekday names) | 6.37 | 6.9 | 4.5 |
| muted on sunk (All day, placeholder) | 5.08 | 8.69 | 4.5 |
| muted on accent-tint (mini-month outside days) | 5.42 | 5.07 | 4.5 |
| accent text on surface (links, focus) | 6.56 | 9.55 | 4.5 |
| accent text on ground | 5.69 | 11.43 | 4.5 |
| on-accent-tint on accent-tint (chosen view, Today pill) | 9.21 | 9.58 | 4.5 |
| on-accent on accent (Create, today numeral, chosen day) | 6.56 | 10.15 | 4.5 |
| now on surface (10:30 text in the list) | 5.43 | 6.45 | 4.5 |
| on-now on now (10:30 chip in the grid) | 5.43 | 7.36 | 4.5 |
| danger on surface (Delete, with its label) | 6.41 | 5.96 | 4.5 |
| danger on sunk (error under a field) | 5.12 | 7.5 | 4.5 |
| on-blue on blue (event text) | 5.95 | 9.25 | 4.5 |
| on-green on green (event text) | 5.53 | 9.55 | 4.5 |
| on-orange on orange (event text) | 6.2 | 9.04 | 4.5 |
| on-purple on purple (event text) | 6.26 | 8.96 | 4.5 |
| outline on surface (button, checkbox edge) | 3.87 | 4.02 | 3 |
| outline on sunk (search and dialog fields) | 3.09 | 5.06 | 3 |
| focus ring on ground | 5.69 | 11.43 | 3 |
| focus ring on surface | 6.56 | 9.55 | 3 |
| focus ring on accent-tint | 5.58 | 7.02 | 3 |
| focus ring on sunk | 5.23 | 12.03 | 3 |
| accent (today square) on accent-tint (the shown week band) | 5.58 | 7.02 | 3 |
| now line on accent-tint (today's column wash) | 4.62 | 4.74 | 3 |
| blue mark on surface | 5.95 | 8.44 | 3 |
| green mark on surface | 5.53 | 8.84 | 3 |
| orange mark on surface | 6.2 | 8.2 | 3 |
| purple mark on surface | 6.26 | 8.14 | 3 |
| green event on accent-tint (today's wash, edge of the block) | 4.71 | 6.5 | 3 |
| surface on ground (card against the page; needs 1.09 or an edge) | 1.15 | 1.2 | 1.09 |
| line on surface (the card's 1px edge; needs 1.3) | 1.43 | 1.49 | 1.3 |

## The runner-up

**Runner-up: A, Ultramarine week (sketch only, not built)**

Note: how this direction was picked. Two directions were sketched (A evolve today, B the week and its day) and two judges compared every pair against today, in both orders, at 1280 light and 390 dark. All 12 verdicts agreed, but split: A 3, B 3, today 0. A beat B on the desktop only because B's mini-month marked today with dark text on moss (a one-token fix); B beat A on the phone because A's three-day grid scrolled sideways can't show the week. The controller picked B and moved its desktop back to the familiar layout (views in the top bar, the left column, My calendars on the first screen). Say so here if you'd rather have A's ultramarine and its calendar grid on the phone.

## The artboards on the board

- Direction · The week and its day
- Week · 1280 · light · today
- Week · 390 · light · today
- Event details · 1280 · light · today
- Event details · 390 · light · today
- Event form · 1280 · light · today
- Event form · 390 · light · today
- Week · 1280 · light · proposed
- Week · 390 · dark · proposed
- Event details · 1280 · light · proposed
- Event details · 390 · dark · proposed
- Event form · 1280 · light · proposed
- Event form · 390 · dark · proposed
- Week · 390 · dark · scrolled to the end · proposed (fixed 390 x 844 frame, not a fluid page)
- Runner-up A, Ultramarine week · light 1280 (sketch)
- Runner-up A, Ultramarine week · dark 390 (sketch)
