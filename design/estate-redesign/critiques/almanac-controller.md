# almanac: the controller's rulings over the critic (2026-11-12)

The critic's verdict is fix; its file is board/critiques/almanac.md. Everything in it stands except where a ruling below says otherwise. Measure on real screens (1280x800, 390x844, 360x800), not on the tall frames.

0. **Dashes come back.** Date and time ranges are data in the app's format: "9 – 15 Nov 2026", "09:30 – 10:00", everywhere you changed them to "to". Waive sloplint gate 19 for them with that reason in the stamp, and remove the sticky about it.
1. **Event form (critic 1): accept.** max-height with a scrolling body and a sticky footer; Reminder and Repeat share a row; 40 px fields, 12 px gaps. Save is on the first screen at 1280x800.
2. **Hours (critic 2): accept.** 48 px per hour and a 56 px day head, so the first 1280 screen reaches 21:00 with all 15 events whole.
3. **Times (critic 3): accept.** A fit check per block instead of a viewport band: 45-minute blocks put the time on a second line, the time at 11/14 condensed; only blocks that can't hold title and time go title-only. No ellipsis.
4. **The left column (critic 4, the clash): My calendars goes back above the day card.** The order is Create, mini-month, My calendars, then `Wednesday, 11 November`. That keeps the recorded left-column order and today's checkboxes on the first screen. The day card stays (the judges' signature for B), below them, and the column scrolls on its own under the header band. Apply the critic's tightening too.
5. **Phone (critic 5): accept.** 48 px one-line rows. Below 380 px the extended Create becomes a 56 px round icon button (plus icon, `aria-label="Create"`), so it never covers Thursday's titles; above 380 it stays extended.
6. **Also accept:** the page background on html and body (no white band at 768), and a 32 px account disc inside its 44 px button.
7. Update almanac.tokens.css and tokens-map.md if any token changed (the hour height, the field height). Re-run every Floor check and report the first-screen measurements: last whole hour and events at 1280x800, calendars visible, Save visible in the form, days and rows at 390x844 and 360x800.
