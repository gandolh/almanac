---
paths:
  - "web/src/**"
---

# The web app (`web/src`)

- Read the `base-ui` skill before you add or change a component. For UI work
  also read [wiki/web-app.md](../../corpus/wiki/web-app.md) and
  [wiki/overlays.md](../../corpus/wiki/overlays.md).
- Base UI is imported only from subpaths (`@base-ui/react/dialog`), and only by
  the wrappers in `web/src/components/ui/`. Pages import the wrapper, never
  `@base-ui/react`.
- A trigger around one of our components uses `render`, never a wrapping
  `span` or `div`.
- Dialogs come from the `Dialog` wrapper, which holds the Escape guard and the
  initial focus.
- Native selects, checkboxes, radios and the time field's list stay native
  ([wiki/decisions.md](../../corpus/wiki/decisions.md)).
- Styling is Tailwind 4 and one stylesheet, `web/src/styles/index.css`, whose
  `@theme` holds every token. Tokens only from `@theme`: no arbitrary colours
  (`bg-[#…]`), no Tailwind palette (it is cleared).
- Class strings that repeat live in `web/src/components/looks.ts` and
  `web/src/event/looks.ts`, whole literals (never built from pieces), and go
  through `cn()` where a later class should win.
- A calendar's colour arrives from data as the inline `--calendar-color` (a
  palette swatch's as `--swatch`); read it with `bg-(color:--calendar-color)`.
  That is the one inline style that holds a colour.
- FullCalendar is styled through its class-name options, never through its
  `.fc-*` classes. Its CSS loads with the calendar only
  (`web/src/calendar/fullcalendar.css`, in the `fullcalendar` layer). The
  classes `cal-mirror` and `cal-highlight` stay: the selection code queries them.
- `dark:` keys off `data-theme` on `<html>`, never `prefers-color-scheme` in a
  component. The colour tokens are `light-dark()` pairs; the Light / Dark /
  System switch is `layout/theme.ts` and the account menu's Theme….
- Tests select by role, text or `data-` attribute, never by a Tailwind class.
- Dates go through `web/src/dates.ts`, routes through `viewRoute` and
  `dateOfRoute`.
- UI copy uses the words of [wiki/glossary.md](../../corpus/wiki/glossary.md).
- `web/vendor/` holds Ward's generated client. Never edit it.
- Static-markup tests mock `@base-ui/react/dialog` with
  `web/src/components/ui/dialog-stub.ts` and assert on roles and text, never on
  class names.
- `npm run check:conventions` runs `check-base-ui` over this folder, strict.
  Its two exceptions (FullCalendar's sheet, the calendar colour) are in
  `scripts/conventions.json`.
