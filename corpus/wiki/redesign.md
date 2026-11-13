---
summary: The three recorded lines brief 05 (2026-11-13) changed, each with its old wording kept as history: Google's look and layout copy, the fixed calendar colours, and the shell at three widths; plus the small calls settled in the same build. Read before touching the look, the calendar colours or the shell.
updated: 2026-11-13
---

# The redesign's reopened decisions

_2026-11-13_, revisited by brief 05, the owner approving the redesign direction
"The week and its day" on the estate board with every question standing as
proposed. Three recorded lines change; the old line stays here as history.

- **The look is Almanac's own.** Was (2026-10-16): "The UI copies Google's
  layout straight, with no design direction round." Now: the layout stays (four
  views, the left column, the drawer, the details popover, Google's places for
  them) and the look is Almanac's: olive-tinted neutrals, raised cards, a moss
  accent that marks only the chosen view and day, Create, links and focus (never
  an event), Sofia Sans with Sofia Sans Condensed for every date and time.
  Google's palette, Roboto, the level shadows and the red now dot are gone.
- **The calendar colours differ by theme.** Was (2026-11-11): "The calendar
  colours are data and look the same in both themes, so the text on an event is
  fixed." Now: the colour is still data (the store keeps the key), but the web
  maps each key to its own per-theme tokens, solid fills with white text on the
  light solids and near-black on the dark ones (`--color-cal-<key>`,
  `--color-on-cal-<key>`). `shared/src/calendar.ts` still holds Google's shades
  and is untouched; changing it is a later brief's.
- **The shell.** Was (`web-app.md`): "Desktop: a 64 px top bar over a 256 px left
  column" and "Below 768 px: the column is a drawer, the view switcher a menu,
  Today an icon, and Create a round button". Now: from 1100 px a 56 px raised
  header band over a 276 px column (Create, the mini-month, My calendars, the
  chosen day's card); from 768 to 1099 px the column is the drawer and the view
  switch a row under the band; below 768 px Week is a strip of day chips over
  an agenda (the time grid stays in Day), a bottom bar replaces the view menu,
  and Create floats above it (a round button under 380 px). The accent shares
  its hue with the `olive` calendar key, which the owner accepted.

Also settled in the same build: ranges keep the app's en dash (`RANGE_DASH`);
the details popover's date line drops the middle dot (the date, then the time
on its own line; quick create keeps `whenText` as it was); weekday heads are
sentence case ("Mon"), not capitals; and the other six calendar keys take the
OKLCH recipe in `web/DESIGN.md`. The design itself is recorded in
[web/DESIGN.md](../../web/DESIGN.md).
