# Task 02: Base UI by the conventions

**Depends on:**

- In Almanac: brief 01, for the gate, the formatter and `.claude/rules/web.md`.
- In the owner's skills library:
  - brief 02, *A base-ui skill, styled with Tailwind*: rules 1-13, the references and `check-base-ui.mjs`;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: the checker runs `--warn-only` until brief 03 here is done.
- The owner's grilling of 2026-11-10: Q15 (Base UI only under `ui/`), Q16 (where native controls stay), Q19 (parity), Q40 (the Drawer), Q41 and Q57 (pickers), Q58 (dialogs), Q59-Q62.

**Runs before:** 03. This brief changes structure and behaviour. Brief 03 then changes only the styling, so its before and after screenshots compare like with like.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The owner's call of 2026-11-09 is Base UI everywhere at 1.9.0, with the base-ui skill's conventions enforced in each repo. Almanac moved its overlays onto Base UI on 2026-10-23 ([wiki/overlays.md](../../wiki/overlays.md), and [wiki/decisions.md](../../wiki/decisions.md), "Base UI under the dialogs, popovers, menus and drawer"). It is already close: no native dialogs, subpath imports, the Escape guard and `initialFocus` in its `Dialog` wrapper. This brief closes the gaps the audit below found. It does not move styling to Tailwind; that is brief 03.

### The pin (verified 2026-11-09)

- `web/package.json` pins `"@base-ui/react": "1.9.0"` exactly.
- `package-lock.json` resolves `node_modules/@base-ui/react` at 1.9.0, with `@base-ui/utils` 0.5.0.
- No code uses the two names 1.9.0 renamed (`OTPFieldPreview`, `sanitizeValue`).

**No bump brief is needed.**

### The audit against rules 1-13 (2026-11-09)

| Rule | Violations | Where |
|---|---|---|
| 1. Exact pin | 0 | |
| 2. Subpath imports, no root barrel | 0 | All 6 imports are subpaths: `/dialog` ×2, `/menu`, `/popover`, `/switch`. |
| 3. Base UI only under a `ui/` folder | **5** | `web/src/components/Dialog.tsx:1`, `web/src/components/Menu.tsx:1`, `web/src/components/Popover.tsx:1` (wrappers, but in `web/src/components/`, not `web/src/components/ui/`); `web/src/layout/AppShell.tsx:1` (the phone drawer, built inline); `web/src/account/Notifications.tsx:1` (`Switch`, used directly) |
| 4. Tailwind on the parts, no class selector aimed at a part | all the Base UI styling | `web/src/styles/components.css` (`.menu*`, `.popover*`, `.dialog*`), `web/src/styles/shell.css` (`.drawer__scrim`, `.drawer__panel`), `web/src/push/notifications.css` (`.switch*`), `web/src/year/year.css:86` (`.popover.day-popover`). **Brief 03's work.** |
| 5-7. One stylesheet, semantic tokens, motion | all of them | **Brief 03's work.** Six inline `style` props set a calendar's colour from data, which rule 5 doesn't allow; they need an exception (brief 03). |
| 8. Floating parts portalled, z from tokens | 0 | Every Base UI popup goes through its `Portal`. The z-indexes are the `--z-*` tokens, plus two local `z-index: 1`s inside one component each (`web/src/event/editor.css:217`, `web/src/search/search.css:73`). The hand-built toast isn't portalled; that is rule 13's row. |
| 9. A trigger around a component uses `render` | 0 | `Menu.Trigger` (`web/src/components/Menu.tsx:62`) wraps a `<span>` or the `trigger` node. The three call sites pass spans and icons (`web/src/layout/ViewSwitcher.tsx:33`, `web/src/layout/AccountMenu.tsx:87`, `web/src/calendars/CalendarRow.tsx:283`). `Dialog.Close` (`web/src/components/Dialog.tsx:61`) wraps `<CloseIcon>`, an `<svg>`. A checker that flags any capitalised child will report it falsely. |
| 10. `Select.Root` with `items` | 0 | No Base UI `Select`. The four `<select>`s are native by decision: `web/src/event/EventForm.tsx:292, 394`, `web/src/event/RepeatPicker.tsx:46, 84`. |
| 11. No `window.confirm`, `alert` or `prompt` | 0 | |
| 12. Dialogs | **2**, both on the drawer | The `Dialog` wrapper (`web/src/components/Dialog.tsx`) passes: controlled, the Escape guard (line 41), `initialFocus` in the house order (lines 51-56), `disablePointerDismissal` through `dismissOnBackdrop={false}`, `Title` (line 60), the close button's `aria-label`. Every form people type into sets `dismissOnBackdrop={false}`: `EventForm.tsx:203`, `ChangePassword.tsx:191`, `CalendarList.tsx:129`, `TimeZoneDialog.tsx:78`, `CalendarRow.tsx:168`. Every icon-only button has an `aria-label`. **The phone drawer** (`web/src/layout/AppShell.tsx:244-257`) has the Escape guard (248) but **no `initialFocus`**, and **no `Title`**: it is named by `aria-label="Calendars"` (253). |
| 13. Base UI over hand-built widgets | **5** | See below. |

**Rule 13's five**, with what Almanac's decisions keep native left out:

1. **The toast**, `web/src/components/Toast.tsx`: a hand-built snackbar with a store, a timer and a live region (`role="status"`, line 62). It becomes Base UI `Toast`. `Toast.createToastManager()` keeps `showToast()` callable from outside React, as `CalendarArea.tsx`'s fetch failure needs, and `Toast.Provider limit={1}` keeps one toast at a time.
2. **The time zone list**, `web/src/account/TimeZoneDialog.tsx:141-212` (`ZoneList`): a hand-built `role="radiogroup"` with a roving `tabIndex` and its own arrow keys (153-178). Its arrows choose, which is what Base UI's `RadioGroup` does, so it becomes `RadioGroup` + `Radio`.
3. **The colour palette**, `web/src/calendars/ColorPicker.tsx:56-77`: the same hand-built pattern (keys at lines 28-52), but on purpose its arrows **move without choosing**, because each choice saves at once (its doc comment, lines 20-26). Base UI's radio clicks its input when keyboard focus lands on it (`RadioRoot`'s `onFocus`, read in 1.9.0), so a `RadioGroup` would save on every arrow press. It becomes a guarded `ToggleGroup` (decision 3).
4. **The weekday toggles** in "Custom days…", `web/src/event/RepeatPicker.tsx:61-78`: seven `aria-pressed` buttons in a `role="group"`. They become `ToggleGroup multiple` + `Toggle`, which gives one Tab stop and arrow keys instead of seven Tab stops.
5. **The delete-calendar confirm**, `web/src/calendars/CalendarRow.tsx:160-187` (`DeleteCalendarDialog`): a confirm on the generic `Dialog`. While `busy`, its buttons are disabled, but Esc and the ✕ still close it. It becomes the skill's confirm pattern, an `AlertDialog` that can't be dismissed while its action runs, with a "Deleting…" label.

**Considered and left:**

- **Kept native by [wiki/decisions.md](../../wiki/decisions.md) (Q16):**
  - the native selects above;
  - the checkboxes `EventForm.tsx:281` and `CalendarRow.tsx:256`;
  - the radios in `web/src/event/scope.tsx:84`;
  - `web/src/event/TimeField.tsx`'s hand-built combobox and list. "So does the time field's list", even though 1.9.0 has `combobox`.
- **No Base UI equivalent:** `web/src/components/MonthGrid.tsx`, a date grid with its own roving focus. It stays.
- **Not a widget:**
  - `web/src/layout/ViewSwitcher.tsx`'s desktop segments are navigation links with `aria-current`;
  - `web/src/search/SearchBox.tsx` is a form.
- **Optional, decision 4:**
  - `web/src/components/Button.tsx` on Base UI's `Button`. Its `focusableWhenDisabled` would let a keyboard reach the disabled Delete's "Only calendar" reason (`CalendarRow.tsx:178`, a `title` on a disabled button).
  - The native `title` tooltips on icon buttons as Base UI `Tooltip`s: `TopBar.tsx:60`, `ViewSwitcher.tsx:60`, `SearchBox.tsx:98`, `QuickCreate.tsx:91`, `DetailsPopover.tsx:84, 87, 90`, `RepeatPicker.tsx:71`, `ColorPicker.tsx:66`.

**A styling class used as a behaviour hook:** `web/src/components/Dialog.tsx:54` finds the footer's first button with `.dialog__footer button:not(:disabled)`. Brief 03 removes that class, so this brief replaces the query with a ref.

### The drawer and Base UI 1.9.0's `Drawer` (decision 2)

1.9.0 ships `@base-ui/react/drawer`. It has:

- Root props `swipeDirection` (`up`, `down`, `left`, `right`), `snapPoints`, `modal` and `disablePointerDismissal`;
- the parts `Backdrop`, `Viewport`, `Popup`, `Content`, `Title`, `Description`, `Close` and `SwipeArea`;
- `initialFocus` and `finalFocus` on the `Popup`;
- the CSS variables `--drawer-swipe-movement-x` and `--drawer-swipe-progress`.

Its docs say: "A panel that slides in from the edge of the screen and doesn't need gesture support is a positioned Dialog", which is why the drawer was built on `Dialog` on 2026-10-23. The owner chose the swipe (Q40, 2026-11-10), so the drawer moves to `Drawer` with `swipeDirection="left"`. A `SwipeArea`, swipe-from-the-edge to open, would fight `web/src/layout/swipe.ts`, which turns a sideways swipe on the view into the next or previous range, so it is left out.

## Owner decisions

1. **Base UI only under `ui/`** (Q15, technical call). Decided 2026-11-10. The three wrappers move to `web/src/components/ui/`, and the drawer and the switch get wrappers there. Wrappers stay in `components/ui/`, the feature-folder layout (Q59).
2. **The phone drawer is Base UI's `Drawer`** (Q40, decided 2026-11-10, owner). The phone navigation panel moves to `@base-ui/react/drawer` with `swipeDirection="left"`, closed by a swipe as well as a tap outside, the X or Esc. No `SwipeArea` (swipe-from-the-edge to open), because it would fight `web/src/layout/swipe.ts`, which turns a sideways swipe on the view into the next or previous range. The `finalFocus` to the menu button stays.
3. **The colour palette** (Q41 and Q57, decided 2026-11-10, technical call). A picker that saves on each choice uses a guarded `ToggleGroup`: arrow keys move focus without saving, and one item always stays pressed. `ColorPicker` moves onto the `ToggleGroup` wrapper, so it is no longer an exception. It announces "pressed" rather than "selected", which is accepted. The time zone list and any filter that switches what a list shows use `RadioGroup`, where arrows may choose.
4. **The optional two** (Base UI `Button`, `Tooltip`s). Still a default: neither in this brief. A tooltip is a visual change, touch screens have no hover, and the Delete reason can be reached another way.
5. **Native controls** (Q16, decided 2026-11-10, technical call). Native text, date and time inputs and native `<select>`s stay native, as [wiki/decisions.md](../../wiki/decisions.md) has them, so the list above stays native.
6. **Dialogs** (Q58, decided 2026-11-10, owner). A dialog that holds a form sets `disablePointerDismissal`: it closes with Cancel, the X or Esc, not an outside tap. The `Dialog` wrapper already does this through `dismissOnBackdrop={false}`, and the five form dialogs keep it. The delete-calendar confirm is a dialog today, not an inline "Delete? Yes / No", so it moves to `AlertDialog` as planned (the inline confirms are Satchel's and Shelfmark's).
7. **Visual parity** (Q19, decided 2026-11-10, owner). Close enough: no visible change to layout or colour at 1280 and 390 px. A few pixels of drift needn't be fixed or listed.
8. **Tests** (Q60 and Q62, decided 2026-11-10, technical calls). jsdom only for wrappers that hold logic; Almanac's static-markup tests stay, and flows stay in Playwright. Tests select by role, and `data-testid` only where no role fits.
9. **The theme switch** is not here. Light / Dark / System (Q18) is brief 03's, where the tokens move; the wrappers built here read tokens only, so they follow it.

## The wrapper set: `web/src/components/ui/`

| File | What it is | From |
|---|---|---|
| `Dialog.tsx` | Base UI `Dialog`, props unchanged; the footer query becomes a ref | `web/src/components/Dialog.tsx`, moved |
| `Popover.tsx` | Base UI `Popover`, props unchanged | `web/src/components/Popover.tsx`, moved |
| `Menu.tsx` | Base UI `Menu`, props unchanged (`finalFocus` running the chosen item stays) | `web/src/components/Menu.tsx`, moved |
| `Drawer.tsx` | the phone drawer on Base UI `Drawer`: `open`, `onClose`, `returnFocus`, `children`; `swipeDirection="left"`; a visually hidden `Title` "Calendars"; `initialFocus` in the house order | `Drawer` in `web/src/layout/AppShell.tsx:232-258`, moved out |
| `Switch.tsx` | Base UI `Switch`: `checked`, `onCheckedChange`, `disabled`, the ARIA props | `web/src/account/Notifications.tsx:89-99` |
| `Toast.tsx` | Base UI `Toast` with a module-level `createToastManager()`; `showToast(message, { action, duration })` keeps its signature and its return value (a dismiss function); `<Toaster/>` renders `Toast.Provider` + `Portal` + `Viewport` | `web/src/components/Toast.tsx`, rebuilt |
| `ConfirmDialog.tsx` | Base UI `AlertDialog`: `title`, `message`, `confirmLabel`, `pendingLabel`, `onConfirm` returning a promise; can't be dismissed while it runs | new; `DeleteCalendarDialog` uses it |
| `RadioGroup.tsx` | Base UI `RadioGroup` + `Radio.Root` + `Radio.Indicator` | new; `ZoneList` uses it |
| `ToggleGroup.tsx` | Base UI `ToggleGroup` + `Toggle`: `multiple` for the weekdays, and a guarded single mode (one item always pressed, arrows only move focus) for the palette | new; the weekday toggles and `ColorPicker` use it |
| `dialog-stub.ts` | the test stub for `@base-ui/react/dialog`, extended for `alert-dialog` if the static tests need it | `web/src/components/dialog-stub.ts`, moved |

`Button.tsx`, `Field.tsx`, `Link.tsx`, `MonthGrid.tsx`, `icons.tsx` and `viewport.ts` stay in `web/src/components/`. None wraps Base UI. `Button` moves to `ui/` only if decision 4 changes.

## Files you OWN

- `web/src/components/ui/**` (new), the files moved out of `web/src/components/`, and every import of them.
- `web/src/layout/AppShell.tsx`: the drawer moves out.
- `web/src/account/Notifications.tsx`, `web/src/account/TimeZoneDialog.tsx`, `web/src/event/RepeatPicker.tsx`, `web/src/calendars/CalendarRow.tsx`, `web/src/calendars/ColorPicker.tsx`: the widgets above.
- The existing CSS rules for markup this brief changes. Rename or move a class rule to the new part; don't restyle. Brief 03 turns them into utilities.
- The tests for all of the above, including the five `vi.mock("@base-ui/react/dialog", …)` paths:
  - `web/src/components/components.test.ts`;
  - `web/src/event/editor.test.ts`;
  - `web/src/event/details.test.ts`;
  - `web/src/calendars/calendars.test.ts`;
  - `web/src/account/notifications.test.ts`.
- Corpus:
  - [wiki/overlays.md](../../wiki/overlays.md): what maps to what, the new wrappers, the stub's path;
  - [wiki/decisions.md](../../wiki/decisions.md): the Base UI entry gains the 2026-11-09 conventions line, and the drawer line if decision 2 changes;
  - [wiki/status.md](../../wiki/status.md);
  - [log.md](../../log.md).

## Files you must NOT touch

- `server/`, `shared/`, and `web/package.json`. Every part needed ships in `@base-ui/react` 1.9.0, so no new dependency.
- Styling beyond renaming a rule's selector. No Tailwind here.
- The behaviours [wiki/overlays.md](../../wiki/overlays.md) records under "Behaviours that needed code": the Escape guard, rename through `finalFocus`, and a press on a popover's anchor. They move with their wrappers unchanged.
- `web/src/event/TimeField.tsx`, `web/src/components/MonthGrid.tsx`, and the native controls.

## What to do

One commit per numbered step. After each, `npm run check` passes, with `check-base-ui` `--warn-only`.

1. **Before.** Run `check-base-ui` strict and record the counts by rule. Expect rule 3 at 5, and rules 4-6 at whatever the checker counts for the CSS. Take Playwright screenshots, at 1280 and 390 px, of:
   - the toast (delete an event);
   - the time zone dialog;
   - the colour palette;
   - "Custom days…";
   - the delete-calendar dialog;
   - the drawer on a phone;
   - the notifications dialog.

   Brief 03's method has the bring-up.
2. **Move the three wrappers** with `git mv` into `web/src/components/ui/`, along with `dialog-stub.ts`. Update the imports. Replace the `.dialog__footer` query with a footer ref. Rule 3's count drops to 2.
3. **`Drawer.tsx`.** Move the drawer out of `AppShell.tsx`. Add the hidden `Title`, and `initialFocus`:
   - the first `[data-autofocus]`;
   - else Create, the first button in the column;
   - else `true`.

   Keep `finalFocus` on the menu button and the Escape guard. Check that a sideways swipe on the open drawer closes it, and that one on the view still steps the range.
4. **`Switch.tsx`.** `Notifications.tsx` uses it. Rule 3 reaches 0.
5. **The toast on Base UI.** Keep:
   - the 5 s timeout, 8 s with an action;
   - one at a time;
   - Undo running its action and closing;
   - ✕ labelled "Dismiss";
   - the live region present before the first toast, so the first message is read out.

   Update `components.test.ts`'s toast assertions, lines 95 and 104, to roles and text.
6. **`ConfirmDialog.tsx`**, and `DeleteCalendarDialog` on it. Keep:
   - "Only calendar" disabling Delete, with its reason shown;
   - the 409 toast;
   - focus returning to the row's ⋮.
7. **`RadioGroup.tsx`**, and `ZoneList` on it. Keep:
   - ↓ from the search field into the list (`onSearchKeyDown`);
   - the chosen zone scrolled into the middle on open (`ZoneList`'s effect, lines 147-151);
   - Home and End;
   - the empty "No time zone matches that." line.
8. **`ToggleGroup.tsx`**, and the weekday toggles on it. Keep the week order (`toggleDay`) and the full weekday names as accessible names.
9. **`ColorPicker` on the guarded `ToggleGroup`.** Keep: each choice saving at once; arrow keys moving focus without saving; one swatch always pressed; the swatch's `--swatch` colour. Delete the hand-built key handling and rewrite its doc comment.
10. **After.**
    - Take the screenshots again and compare them (decision 7: no visible change to layout or colour; a few pixels of drift needn't be fixed or listed).
    - Run `check-base-ui` strict: rules 1-3 and 8-11 report 0.
    - Update [wiki/overlays.md](../../wiki/overlays.md), [wiki/decisions.md](../../wiki/decisions.md), [wiki/status.md](../../wiki/status.md) and [log.md](../../log.md).

## Acceptance

- [ ] `grep -rn "@base-ui/react" web/src --include=*.tsx --include=*.ts | grep -v "components/ui/" | grep -v "vi.mock"` prints nothing.
- [ ] `check-base-ui` strict reports 0 for rules 1, 2, 3, 9, 10 and 11, with no `ColorPicker` exception. Rules 4-7 are left for brief 03, and their counts are in the outcome note.
- [ ] The drawer is on Base UI `Drawer`, has a `Title` and `initialFocus`, and its Escape guard still lets Esc close a rename field inside it without closing the drawer. That is a test, not a manual check. A swipe left closes it (a Playwright test at 390 px), and a swipe on the view still steps the range.
- [ ] Every dialog that holds a form closes with Cancel, the X or Esc, and not on an outside tap. That is a test per form dialog.
- [ ] `showToast()`'s signature is unchanged and every caller is untouched. A test shows a second toast replacing the first.
- [ ] Delete calendar can't be closed by Esc or ✕ while its request runs. That is a test.
- [ ] The time zone list and the weekday toggles work from the keyboard as listed in steps 7 and 8. The palette's arrows move focus without saving, a choice saves once, and one swatch stays pressed (step 9). Those are tests, selected by role.
- [ ] The before and after screenshots at 1280 and 390 px show no visible change to layout or colour.
- [ ] `npm run check` passes, and `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 03 styles `web/src/components/ui/` with Tailwind on the parts, and removes the CSS rules this brief renamed.
- The skills library's `check-base-ui` heuristic for rule 9 may flag `Dialog.Close` around an icon. That is a false positive, to report to the skill rather than to except here.

## Outcome (2026-11-11)

Built in ten commits on `main`.
- **Wrappers**, all under `web/src/components/ui/`: `Dialog`, `Menu`, `Popover` (moved), `Drawer`, `Switch`, `Toast`, `ConfirmDialog`, `RadioGroup`, `ToggleGroup`, `dialog-stub.ts` (also stubs `alert-dialog`). The drawer is Base UI's `Drawer` (swipe left closes it, no `SwipeArea`); the toast, the delete-calendar confirm, the time zone list, the weekday toggles and the colour palette sit on Base UI parts.
- **`check-base-ui`:** before 19 errors (rule-3 5, rule-5 14). After 14 (rule-5 14): rules 1-4, 6, 7 and 9-11 report 0, no `ColorPicker` exception. It stays `--warn-only` until brief 03 removes the other stylesheets. The grep for `@base-ui/react` outside `components/ui/` prints nothing.
- **Tests:** 745 to 771. jsdom tests per wrapper that holds logic (ToggleGroup, RadioGroup, ConfirmDialog, Drawer, Toast), `ColorPicker.test.tsx`, `RepeatPicker.test.tsx`; static-markup tests kept for the rest. `npm run check` exits 0.
- **Browser walk** (two throwaway clones, a made-up local account, scratch data; Playwright scripts in the scratch folder, not committed): drawer Esc guard, swipe left closes, swipe on the view steps the range, focus returns to the menu button; a second toast replaces the first; delete-calendar can't be closed by Esc, the X or an outside press while its request runs, says "Deleting…", and Cancel returns focus to the row's options button; the time zone list scrolls to the chosen zone, ↓ from the search field enters it, arrows, Home and End choose; the palette's arrows move focus without a request, Enter saves once and closes the popover; custom days press by click.
- **Screenshots** at 1280 and 390 px of the seven states, before and after, compared pixel by pixel: no layout or colour change; the only differing pixels (0.07%) are the current-time line moving between runs. One find on the way: Base UI's toast title is an `h2`, which showed in a larger bold face; it renders as a `span` now.
- **Deviations.**
  - `jsdom`, `@testing-library/react`, `@testing-library/dom` and `@testing-library/user-event` were added as exact-pinned devDependencies in the root `package.json` (versions as in `lantern`), because the brief asks for behaviour tests and Almanac had no DOM. `web/package.json` is untouched.
  - `showToast` gained an optional `type: "error"` (stays until dismissed). No caller passes it, since the brief leaves every caller untouched, so today's failure toasts still time out; marking them is one line each (`CalendarArea.tsx`, `YearView.tsx`, `DetailsPopover.tsx`, `CalendarList.tsx`) and is left to the owner's call.
  - The guarded `ToggleGroup` reports the pressed swatch again when it is pressed again (the colour popover closes on it) instead of dropping the change.
  - Base UI's `RadioGroup` leaves out Home and End; the wrapper adds them. It also wraps at the ends where the hand-built list stopped.
  - The palette's Tab stop is its first swatch, not the chosen one (Base UI's `Toggle` doesn't mark the pressed item active); focus still starts on the chosen swatch when the popover opens.
  - The swipe on the drawer and the zone list's scroll are browser-checked, not committed tests: jsdom has no touch or layout, and Almanac has no Playwright setup.
