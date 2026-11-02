---
summary: How Almanac's dialogs, popovers, menus and phone drawer sit on Base UI since 2026-10-23. What each wrapper maps to, the three behaviours that needed explicit code (Esc a control already handled, rename from a menu via finalFocus, a press on a popover's anchor), why the drawer is a modal Dialog, the dialog stub the static tests use, what stayed native, and the three visual differences that were kept.
updated: 2026-11-01
---

# Overlays

The decision is in [decisions.md](decisions.md), "Base UI under the dialogs,
popovers, menus and drawer". `@base-ui/react` is pinned at 1.9.0 and Almanac
keeps its own CSS. The wrappers in `web/src/components/` kept their props, so
no call site changed when they moved. Base UI now owns focus, keys, placement
and nesting; the old `layer.ts`, `placePopover` and `escapeClosesDrawer` are
gone.

## What maps to what

- **`Dialog`**: Base UI `Dialog`. `onClose` is `onOpenChange(false)`,
  `[data-autofocus]` is `initialFocus`, and `dismissOnBackdrop={false}` stops
  outside presses (the event form uses it). Full screen below 768 px.
- **`Popover`**: Base UI `Popover`, "mounted means open". The anchor is an
  element or a `DOMRect` (a press on an empty slot), which becomes a virtual
  element. `placement: "below"` is `side="bottom" align="start"` and `"side"`
  is `side="right" align="start"`; Base UI's collision handling flips it.
  The app's shortcuts are off while one is open.
- **`Menu`**: Base UI `Menu`. Sections are `Menu.Group` + `GroupLabel`, or a
  separator when unlabelled; items with `selected` are a `RadioGroup` with the
  tick in `RadioItemIndicator`.
- **The phone drawer** (`layout/AppShell.tsx`) is a modal `Dialog`, not Base
  UI's `Drawer`: Base UI's docs say a side panel without swipe gestures is a
  positioned Dialog, and Almanac's drawer has none. Its scrim is the backdrop.

Native selects, checkboxes and radios stay native. So does `TimeField`'s list:
it renders inline, not portalled, so it already works inside a Base UI dialog,
and its commit-on-blur and Esc rules are tested.

## Behaviours that needed code

- **Esc a control already used.** Base UI's Esc listener ignores
  `defaultPrevented`, so with the time list open, Esc closed the whole event
  form. The dialog, popover and drawer now ignore an Esc a control inside
  already handled, as the native `<dialog>` did.
- **Rename from a row menu in the drawer.** Base UI returns focus to the
  trigger after a choice. Rename swaps the trigger for a field, so focus fell
  back to "Main menu", which blurred the field and cancelled the rename. The
  chosen item now runs from the menu's `finalFocus`: focus goes back first,
  then the item runs.
- **A press on a popover's anchor** is ignored in `onOpenChange`, so the
  anchor's own click still toggles it.

## Tests

Base UI's portal renders nothing without a DOM. The static-markup tests that
render a dialog (`components`, `editor`, `details`, `calendars`) mock
`@base-ui/react/dialog` with `components/dialog-stub.ts`, which renders the
parts in place.

## Differences kept from the hand-built version

- A menu opened by mouse doesn't highlight its first item.
- The phone's view menu opened by keyboard starts on the first view, not the
  chosen one.
- On a phone, the event details popover hangs below the event instead of
  covering it. The old code centred it over the anchor when neither side had
  room; Base UI moves it to the other axis. Kept: the event stays visible, and
  copying the centring would mean offset maths on top of Base UI.

The move cost about 50 kB gzip on the main chunk (137.79 to 187.92 kB).
