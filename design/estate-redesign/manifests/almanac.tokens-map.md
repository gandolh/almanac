# Almanac tokens: board role to app token

Mechanism: the app's own `light-dark()` inside `@theme static`; no second colour block, only the shadows have a `[data-theme="dark"]` block. Board ground, surface, ink, muted, outline, accent, accent-tint, focus, scrim and the type sizes sit under the app's names with new values.

## Renamed or remapped (board role to app token)
- sunk -> `field` (search, dialog fields, the all-day row)
- line -> `hairline`, and `divider` takes the same value
- accent-ink (text on the tint) -> `accent-ink`; the board's on-accent -> `on-accent`
- now -> `now-line`; focus -> `focus-ring`
- toast: ink/ground inverted -> `toast-surface`, `toast-ink`, `toast-action`
- control: the board has no secondary fill; `control` keeps its name for hover and the segmented track
- fonts: Roboto -> Sofia Sans (`font-sans`); sizes 15/17/20/24/26 fold into 12, 13, 14, 16, 18, 22 (`text-body` 15 -> 14, `text-day-number` 26 -> 22, `text-range-phone` 17 -> 22)
- radii: board control 10 -> `radius-control` (was 8); dialog 16 -> `radius-container`; sheet 20 -> `radius-sheet`
- shadows: card -> new `shadow-card`; popover and dialog -> `shadow-float` (`shadow-dialog` aliases it)
- sizes: `height-topbar` 64 -> 56, `width-sidebar` 256 -> 276, `height-create` 56 -> 44, `size-fab` 56 -> 52, `width-popover` 448 -> 340, `height-editor-field` 36 -> 40, `width-time-field` 88 stays (112 on a phone)

## New tokens (component that needs them)
- `on-now`: the 10:30 chip in the grid gutter
- `danger`: Delete in the popover and sheet, the form's errors
- `cal-blue|green|orange|purple` and `on-cal-*`: event blocks, the day list's marks, the calendar checkboxes, the strip's ticks (solid fill with its own text colour per theme; shared/src/calendar.ts keeps the keys and is a later brief; the other six keys are not designed)
- `font-num`: every date and time, the wordmark
- `text-event-time`: a block's time line
- `radius-event`, `radius-card`: blocks; the header band's cards
- `shadow-card`: cards in light
- `height-bottom-bar`, `height-hour` (48 px): the phone view bar and the week grid

## App tokens the design no longer uses (keep or drop is the code brief's call)
- `shadow-raised`, `shadow-raised-hover` (Create is flat now)
- `size-day-disc`, `size-day-disc-phone` (today is a rounded-square tab, not a disc)
- `accent-tint-soft` is kept only for menu rows
- `text-mini`, `text-badge` (mini-month days are 14, the phone Today icon keeps its 9)
- `size-icon-button-small` and `size-mini-day`/`size-mini-cell` stay for the mini-month but the board draws it at 32 px cells and 36 px arrows
- `--font-weight-*` unchanged. Google-specific comments in index.css (Google's palette, level 1 and 2) should be rewritten.
