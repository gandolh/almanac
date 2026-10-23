# Task 12: Base UI under Dialog, Popover, Menu and the drawer

## Context

On 2026-10-23 the owner asked for Base UI (`@base-ui/react`) in the apps that
still hand-build their interactive widgets, to match their other apps
(atrium, imbatranimOS, sports-app, trips, ro-housing, public-resource-map,
newspapper). Base UI is headless: it supplies focus handling, keyboard
behaviour, positioning and ARIA, and Almanac keeps its own CSS and tokens.

Almanac's widgets are hand-built in `web/src/components/`:

- `Dialog.tsx` (97 lines): native `<dialog>` + `showModal`, a size prop,
  full screen below 768 px, `dismissOnBackdrop`, focus on
  `[data-autofocus]`. Used by `EventForm`, `scope.tsx`, `TimeZoneDialog`,
  `ChangePassword`, `CalendarList`, `CalendarRow`.
- `Popover.tsx` (164 lines): an anchored non-modal panel. The anchor is an
  element **or a `DOMRect`** (a press on an empty slot). `placement` is
  `below` or `side`, with its own flip maths (`placePopover`, unit-tested).
  Used by `QuickCreate`, `DetailsPopover`, `YearView`, `CalendarRow`.
- `Menu.tsx` (243 lines): the WAI-ARIA menu button, with sections and radio
  items (`selected`). Used by `AccountMenu`, `ViewSwitcher`, `CalendarRow`.
- `layer.ts`: portals menus and popovers into an open `<dialog>`, because a
  modal `<dialog>` makes the rest of the page inert.
- `web/src/layout/AppShell.tsx` `Drawer`: the phone's calendar column, with a scrim,
  its own Escape handling (`escapeClosesDrawer`) and an inert shell.

All four must move in one go. A Base UI modal dialog traps focus in its own
tree, so a hand-built popover portalled to `body` would lose focus to it.

The pattern to copy is `../newspapper/ui/src/components/ui/Modal.tsx`: Base UI
`Dialog`, the app's own stylesheet, and the component's props unchanged.

## Files you OWN

```
web/src/components/{Dialog,Popover,Menu}.tsx  web/src/components/layer.ts
web/src/components/components.test.ts  web/src/layout/AppShell.tsx
web/src/event/TimeField.tsx (only if step 6 goes ahead)  web/src/styles/**
web/package.json (dependencies only)  package-lock.json
corpus/wiki/{decisions,status}.md
```

Call sites (`EventForm`, `QuickCreate`, `DetailsPopover`, `YearView`,
`CalendarRow`, `CalendarList`, `AccountMenu`, `ViewSwitcher`, `scope.tsx`,
`TimeZoneDialog`, `ChangePassword`) change only if a prop truly can't be kept.
Say so in the outcome note if one does.

## Files you must NOT touch

`shared/`, `server/`, FullCalendar's views and their CSS overrides.

## What to do

1. Add `"@base-ui/react": "1.9.0"` to `web/package.json` dependencies,
   pinned exactly like the rest, then run `npm install` from the root.
2. **Dialog → Base UI `Dialog`.** Keep `DialogProps` as it is. `onClose` is
   `onOpenChange(false)`. `dismissOnBackdrop={false}` stops outside presses
   (use the `eventDetails.reason` that Base UI passes, or `disablePointerDismissal`). Map
   `[data-autofocus]` to `initialFocus`. The title row is `Dialog.Title` and
   `Dialog.Close`. Restyle `.dialog` / `::backdrop` onto `Dialog.Popup` /
   `Dialog.Backdrop`, keeping the sizes and the phone full-screen layout.
3. **Popover → Base UI `Popover`.** Keep `PopoverProps` and keep "mounted
   means open". Pass the anchor to `Popover.Positioner`'s `anchor` prop. A
   `DOMRect` becomes a virtual element (`{ getBoundingClientRect: () => rect }`).
   `placement: "below"` maps to `side="bottom" align="start"` and `"side"` to
   `side="right" align="start"`, with Base UI's collision handling doing the
   flipping. Delete `placePopover` and its tests. Keep "a press on the anchor
   doesn't close it" and "the app's shortcuts are off while one is open".
4. **Menu → Base UI `Menu`.** Keep `MenuProps`/`MenuSection`/`MenuItem`.
   Sections become `Menu.Group` + `Menu.GroupLabel`, or a `Menu.Separator`
   when unlabelled. Items with `selected` become a `Menu.RadioGroup` of
   `Menu.RadioItem`s with the tick in `Menu.RadioItemIndicator`. `detail` stays
   muted text at the row's end. `align` maps to the positioner's `align`.
5. **Drawer → Base UI `Drawer`** (or a modal `Dialog` if Drawer fights the
   layout): the scrim is the backdrop, and Escape/outside press close it. Delete
   `escapeClosesDrawer`, because Base UI closes the innermost popup first. Then
   delete `layer.ts`, since Base UI nests portals on its own.
6. **TimeField (optional).** Try Base UI `Autocomplete`, which is free text
   with a suggestion list. Port it only if it keeps commit-on-blur, Escape
   closing only the list, and focus staying in the field when picking.
   Otherwise leave it hand-built and say why in the outcome note.
7. **Styles.** Point selectors that keyed off the old markup at Base UI's
   attributes (`data-open`, `data-side`, `data-highlighted`, `data-checked`,
   `data-starting-style`, `data-ending-style`). Keep the look the same.
8. Native `<select>`s (`RepeatPicker`, `EventForm`), checkboxes and radios
   stay native. They're already accessible, and swapping them would only
   restyle them.
9. Add a `decisions.md` entry: Base UI for overlays and composite widgets,
   dated 2026-10-23, the owner's call to match their other apps. Rejected:
   keeping the hand-built components, and shadcn (it brings Tailwind, which
   Almanac doesn't use). Update `status.md`.

## Acceptance

- `npm run typecheck && npm run lint && npm run test && npm run build` pass.
- Browser check against the dev server, at 1440 px and 390 px:
  - **event form** (a dialog): focus lands on the title, Tab stays inside,
    Escape closes, and focus returns;
  - **quick create** opened from an empty slot: the `DOMRect` anchor sits
    beside the slot and flips near the right edge;
  - **calendar row** menu: arrow keys, type-ahead, Escape returns to the
    button;
  - **colour popover** opened from that row inside the phone drawer, and a
    menu opened inside a dialog: both work, and Escape closes only the
    innermost layer;
  - **view switcher**: the tick shows on the current view.
  Take before/after screenshots of each. They should match.
- `layer.ts` and the hand-built focus, keyboard and positioning code are gone.
- `bash corpus/lint.sh` passes.

## Outcome (2026-10-23)

Done. `@base-ui/react` 1.9.0 is pinned in `web/package.json`. `Dialog`,
`Popover` and `Menu` keep their props, and no call site changed. The drawer is
a modal Base UI `Dialog`, not `Drawer`: Base UI's docs say a side panel
without swipe gestures is a positioned Dialog, and Almanac's drawer has none.
`layer.ts`, `placePopover`, `escapeClosesDrawer` and the hand-written focus,
key and placement code are deleted.

Three behaviours needed explicit code to survive the move:

- **Esc a control already used.** With the time list open, Esc closed the
  whole event form, because Base UI's Esc listener doesn't check
  `defaultPrevented`. The dialog, the popover and the drawer now ignore an Esc
  that a control inside already handled, as the native `<dialog>` and the old
  popover did.
- **Rename from the row menu in the drawer.** Base UI returns focus after a
  choice. The trigger was gone (Rename swaps it for a field), so Base UI fell
  back to "Main menu", which blurred the field and cancelled the rename. The
  chosen item now runs from the menu's `finalFocus`: focus goes to the button,
  then the item runs, the old order.
- **A press on a popover's anchor** is ignored in `onOpenChange`, so the
  anchor's own click still toggles.

Tests changed outside the owned files. `layout.test.ts` lost the
`escapeClosesDrawer` test, and `components.test.ts` lost the `placePopover`
ones. Base UI's portal renders nothing without a DOM, so the static-markup
tests that render a dialog (`components`, `editor`, `details`, `calendars`)
mock `@base-ui/react/dialog` with the new `components/dialog-stub.ts`, which
renders the parts in place. 618 tests pass, down from 623 by the five deleted
ones.

Checked: typecheck, lint, tests and build. The main chunk grows from 137.79
to 187.92 kB gzip. In Chromium at 1440 and 390 px against a scratch account,
the same scripted steps were run before and after:

- the event form: focus on the title, Tab held, Esc closes, and focus back on
  Create;
- quick create from a slot, flipping left near the right edge;
- the details and year-day popovers;
- the row and account menus: arrows, Home/End, type-ahead, and Esc back to the
  button;
- Change password;
- the drawer, with the row menu, the colour popover and New calendar inside
  it: Esc closes only the innermost layer, and a scrim press returns focus to
  Main menu;
- the view menu's tick;
- shortcuts staying off under each overlay.

The screenshots match, with three differences:

- a menu opened by mouse no longer highlights its first item;
- the phone's view menu opened by keyboard starts on the first view, not the
  chosen one;
- on a phone, the event details popover hangs below the event instead of
  covering it. `placePopover` centred it over the anchor when neither side had
  room; Base UI moves it to the other axis. It was kept: the event stays
  visible, and copying the old centring would mean offset maths on top of
  Base UI.

**TimeField (step 6) was not ported.** Its list is rendered inline, not
portalled, so it works inside the Base UI dialog as it is. Its commit-on-blur
and Esc rules are tested and hold. The four required moves were the brief.
