# almanac: judge result (2026-11-12)

Two opus judges, j2 reversed; all 12 verdicts agree.

| Pair | 1280 light | 390 dark |
|---|---|---|
| T vs A | A (G1) | A (G1) |
| B vs T | B (G1) | B (G1) |
| A vs B | A (G3: B's mini-month today numeral, dark on moss, ~1.7:1) | B (G3: A's + covers "Dinner with Alex", Saturday clipped) |

Wins: **A 3, B 3, T 0.** Today failed G1 in every pair (one flat sheet) and G3 too (titles cut to "Team stand…", "Tea…"); judges also flagged its palette as a famous calendar's.

## The controller's call on the split (2026-11-12)

**Winner: B "The week and its day". Runner-up: A "Ultramarine week".**

Why:
- B's desktop loss is one token (the today numeral on the moss chip). A's phone loss is structural: a three-day grid scrolled sideways cannot show "this week", the screen's job, and both judges said so in every phone pair. The owner's main phone is Android, so the phone weighs as much as the desktop.
- Rubric margins: desktop A vs B within 3 points (83/80, 80.5/80); phone B ahead by 7-9 (82.5/73, 77.5/70.5).
- B's palette and condensed numerals scored as "its own" in both runs.

But B's desktop skeleton is ruled back toward the familiar: both judges' "loser better at" on the desktop A-vs-B pairs is the same thing (the views and date tools sit where calendar users look in A), the owner prefers familiar navigation over a new layout, and the left column's contents are a recorded limit.

## Rulings for the full build of B (they override the direction file)

1. **Desktop shell (≥1100):** no view rail. The header band (56 px, raised) holds the wordmark, `Today`, ‹ ›, `9 – 15 Nov 2026`, then at the right the search field, the `Day` `Week` `Month` `Year` segmented switch (Week chosen) and the disc `T`.
2. **The left column** (about 288 px, on `ground`), as today's order: `Create` (labelled accent button, full width); the mini-month card; **B's day card `Wednesday, 11 November`** (its rows, the `10:30` now rule, Room 2) between the mini-month and My calendars; the My calendars card. The grid card takes the rest of the width. No right pane. Under 1100 the column folds into the drawer as today.
3. **Contrast:** the today numeral on any moss fill is light ink at ≥4.5:1, in the mini-month, the week head and the phone strip. Check every place text sits on `accent`.
4. **Event blocks:** keep B's solid fills with text on solid. Short events show the start time like every other block (Team standup included). Nothing is ellipsised: a block too short for its title shows the title only and the full row lives in the details.
5. **Phone (390):** keep B's skeleton (top bar, sticky strip of seven day chips with ticks, bottom view bar, extended Create). The agenda continues past the chosen day: date-headed sections for every remaining day of the week (Thu 12 to Sun 15) under Wednesday's card, so the screen answers "what's on this week" without tapping. Tapping a strip chip scrolls to that day's section and marks it chosen.
6. **Nothing covers content:** the list pads by the bar, the Create button and the gesture inset; draw a scrolled state where the last row sits clear of Create.
7. **Ask stickies for the owner:**
   - on the phone the week becomes a strip plus an agenda; the time grid stays in Day (judges: a time grid shows gaps and clashes better, the strip shows the week's shape);
   - the bottom view bar replaces the `Week` menu (web-app.md's phone shell);
   - calendar colours per theme (reopens decisions.md "look the same in both themes" and `shared/src/calendar.ts`; the web maps keys to its own tokens, shared/ is a later brief);
   - the moss accent shares the `olive` calendar key's hue.
