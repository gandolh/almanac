---
summary: How Almanac's dialogs, popovers, menus, phone drawer, toast, switch, confirm, time zone list, weekday toggles and colour palette sit on Base UI (overlays since 2026-10-23, the rest since 2026-11-11). Every wrapper lives in web/src/components/ui/. What each maps to, the behaviours that needed explicit code (Esc a control already handled, rename from a menu via finalFocus, a press on a popover's anchor, Home and End in the radio group, the guarded toggle group), the dialog stub and the jsdom tests, what stayed native, and the visual differences that were kept.
updated: 2026-11-11
---

# Overlays

The decision is in [decisions.md](decisions.md), "Base UI under the dialogs,
popovers, menus and drawer". `@base-ui/react` is pinned at 1.9.0 and Almanac
keeps its own CSS. The wrappers live in `web/src/components/ui/`, the only
place that imports `@base-ui/react` (base-ui rule 3); the first three kept
their props when they moved there, so no call site changed. Base UI now owns focus, keys, placement
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
- **The phone drawer** (`ui/Drawer.tsx`, used by `layout/AppShell.tsx`):
  Base UI's `Drawer` with `swipeDirection="left"`, so a swipe to the left
  closes it as well as a press on the dim, Esc and Android's back
  gesture. It is named "Calendars" by a visually hidden `Title`, starts focus
  on the first `[data-autofocus]` or Create, and returns it to the menu button
  (`returnFocus`). There is no `SwipeArea` (swipe from the edge to open): it
  would fight `layout/swipe.ts`, which turns a sideways swipe on the view into
  the next or previous range. The drawer is portalled, outside `main`, so that
  hook never sees a swipe on the open drawer.
- **`Toast`** (`ui/Toast.tsx`): Base UI `Toast` with one module-level
  `createToastManager()`, so `showToast(message, { action, duration })` still
  works from anywhere and returns a dismiss function. `<Toaster/>` (mounted by
  the shell) is `Toast.Provider limit={1}` + `Portal` + `Viewport`, a labelled
  region that is there before the first toast. A new toast closes the last. 5 s,
  8 s with an action; `type: "error"` stays until dismissed.
- **`Switch`** (`ui/Switch.tsx`): the notifications dialog's switch.
- **`ConfirmDialog`** (`ui/ConfirmDialog.tsx`): Base UI `AlertDialog`; Cancel has
  focus, an outside press doesn't close it, and while its promise runs nothing
  closes it and the action says its `pendingLabel`. `DeleteCalendarDialog` uses it.
- **`RadioGroup`** (`ui/RadioGroup.tsx`): Base UI `RadioGroup` + `Radio.Root`
  (`RadioItem`) + `Radio.Indicator`; the time zone list. Arrows move and
  choose; Home and End are added in the wrapper, which Base UI's group leaves out.
- **`ToggleGroup`** (`ui/ToggleGroup.tsx`): Base UI `ToggleGroup` + `Toggle`
  with ↑ ↓ added for a group over two rows. `multiple` for the weekdays of
  "Custom days…" (one Tab stop and arrow keys, in place of seven Tab stops);
  the default is the guarded group for the colour palette, which saves on each
  choice: arrows only move focus, one swatch stays pressed, and pressing the
  pressed one again reports it again (the popover closes on it) instead of
  clearing it.

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
render a dialog (`components`, `editor`, `details`, `calendars`, `notifications`)
mock `@base-ui/react/dialog`, and for the confirm `@base-ui/react/alert-dialog`,
with `components/ui/dialog-stub.ts`, which renders the parts in place.

What the wrappers promise (focus, Esc, a pending action, one Tab stop, the
guarded group, a second toast replacing the first) is tested in jsdom, with
`// @vitest-environment jsdom` on top of the file, Testing Library and
`user-event`, selecting by role. They sit beside the wrappers
(`ui/*.test.tsx`), `ColorPicker.test.tsx` and `RepeatPicker.test.tsx`.
jsdom has no touch events or layout, so the swipe on the drawer and the
scroll of the time zone list to the chosen zone were checked in a browser, not
by a committed test (Almanac has no Playwright setup).

## Differences kept from the hand-built version

- A menu opened by mouse doesn't highlight its first item.
- The phone's view menu opened by keyboard starts on the first view, not the
  chosen one.
- On a phone, the event details popover hangs below the event instead of
  covering it. The old code centred it over the anchor when neither side had
  room; Base UI moves it to the other axis. Kept: the event stays visible, and
  copying the centring would mean offset maths on top of Base UI.

The first move cost about 50 kB gzip on the main chunk (137.79 to 187.92 kB).
