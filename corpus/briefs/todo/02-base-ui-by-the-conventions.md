# Task 02: Base UI by the conventions

**Depends on:**

- In Almanac: brief 01, for the gate, the formatter and `.claude/rules/web.md`.
- In the owner's skills library:
  - brief 02, *A base-ui skill, styled with Tailwind*: rules 1-13, the references and `check-base-ui.mjs`;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: the checker runs `--warn-only` until brief 03 here is done.
- The owner's grilling of 2026-11-10: Q15 (Base UI only under `ui/`) and Q16 (where native controls stay), plus the two new questions below.

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
3. **The colour palette**, `web/src/calendars/ColorPicker.tsx:56-77`: the same hand-built pattern (keys at lines 28-52), but on purpose its arrows **move without choosing**, because each choice saves at once (its doc comment, lines 20-26). Base UI's radio clicks its input when keyboard focus lands on it (`RadioRoot`'s `onFocus`, read in 1.9.0), so a `RadioGroup` would save on every arrow press. See decision 3.
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

### The drawer and Base UI 1.9.0's `Drawer`

1.9.0 ships `@base-ui/react/drawer`. It has:

- Root props `swipeDirection` (`up`, `down`, `left`, `right`), `snapPoints`, `modal` and `disablePointerDismissal`;
- the parts `Backdrop`, `Viewport`, `Popup`, `Content`, `Title`, `Description`, `Close` and `SwipeArea`;
- `initialFocus` and `finalFocus` on the `Popup`;
- the CSS variables `--drawer-swipe-movement-x` and `--drawer-swipe-progress`.

Its docs still say: "A panel that slides in from the edge of the screen and doesn't need gesture support is a positioned Dialog", which is why the drawer was built on `Dialog` on 2026-10-23.

What `Drawer` would add is swipe-to-close (`swipeDirection="left"`). A `SwipeArea`, swipe-from-the-edge to open, would fight `web/src/layout/swipe.ts`, which turns a sideways swipe on the view into the next or previous range. So it would be left out. See decision 2.

## Owner decisions (defaults this brief builds)

1. **Base UI only under `ui/`** (Q15). Default: yes. The three wrappers move to `web/src/components/ui/`, and the drawer and the switch get wrappers there.
2. **The phone drawer: `Dialog` or `Drawer`?** Default: it stays a Base UI `Dialog`, which is Base UI's own advice for a panel without gestures, and keeps today's behaviour. If the owner wants swipe-to-close, the `Drawer` wrapper uses `Drawer.Root swipeDirection="left"`, no `SwipeArea`, and the same `finalFocus` to the menu button. *New question for the grilling.*
3. **The colour palette's arrow keys.** Default: `ColorPicker` stays hand-built, recorded as an exception in `scripts/conventions.json` with the reason (each choice saves, and Base UI radios choose on arrow keys). The alternative is `ToggleGroup`, whose arrows move without pressing, but which announces "pressed" instead of "selected". *New question for the grilling.* The answer applies to any picker in the estate that saves on each choice.
4. **The optional two** (Base UI `Button`, `Tooltip`s). Default: neither in this brief. A tooltip is a visual change, touch screens have no hover, and the Delete reason can be reached another way.
5. **Native controls** (Q16). Default: as [wiki/decisions.md](../../wiki/decisions.md) has them, so the list above stays native.

## The wrapper set: `web/src/components/ui/`

| File | What it is | From |
|---|---|---|
| `Dialog.tsx` | Base UI `Dialog`, props unchanged; the footer query becomes a ref | `web/src/components/Dialog.tsx`, moved |
| `Popover.tsx` | Base UI `Popover`, props unchanged | `web/src/components/Popover.tsx`, moved |
| `Menu.tsx` | Base UI `Menu`, props unchanged (`finalFocus` running the chosen item stays) | `web/src/components/Menu.tsx`, moved |
| `Drawer.tsx` | the phone drawer: `open`, `onClose`, `returnFocus`, `children`; a visually hidden `Title` "Calendars"; `initialFocus` in the house order; on `Dialog` or `Drawer` per decision 2 | `Drawer` in `web/src/layout/AppShell.tsx:232-258`, moved out |
| `Switch.tsx` | Base UI `Switch`: `checked`, `onCheckedChange`, `disabled`, the ARIA props | `web/src/account/Notifications.tsx:89-99` |
| `Toast.tsx` | Base UI `Toast` with a module-level `createToastManager()`; `showToast(message, { action, duration })` keeps its signature and its return value (a dismiss function); `<Toaster/>` renders `Toast.Provider` + `Portal` + `Viewport` | `web/src/components/Toast.tsx`, rebuilt |
| `ConfirmDialog.tsx` | Base UI `AlertDialog`: `title`, `message`, `confirmLabel`, `pendingLabel`, `onConfirm` returning a promise; can't be dismissed while it runs | new; `DeleteCalendarDialog` uses it |
| `RadioGroup.tsx` | Base UI `RadioGroup` + `Radio.Root` + `Radio.Indicator` | new; `ZoneList` uses it (and `ColorPicker`, if decision 3 changes) |
| `ToggleGroup.tsx` | Base UI `ToggleGroup` + `Toggle`, `multiple` | new; the weekday toggles use it |
| `dialog-stub.ts` | the test stub for `@base-ui/react/dialog`, extended for `alert-dialog` if the static tests need it | `web/src/components/dialog-stub.ts`, moved |

`Button.tsx`, `Field.tsx`, `Link.tsx`, `MonthGrid.tsx`, `icons.tsx` and `viewport.ts` stay in `web/src/components/`. None wraps Base UI. `Button` moves to `ui/` only if decision 4 changes.

## Files you OWN

- `web/src/components/ui/**` (new), the files moved out of `web/src/components/`, and every import of them.
- `web/src/layout/AppShell.tsx`: the drawer moves out.
- `web/src/account/Notifications.tsx`, `web/src/account/TimeZoneDialog.tsx`, `web/src/event/RepeatPicker.tsx`, `web/src/calendars/CalendarRow.tsx`: the widgets above. `web/src/calendars/ColorPicker.tsx`, only if decision 3 changes.
- The existing CSS rules for markup this brief changes. Rename or move a class rule to the new part; don't restyle. Brief 03 turns them into utilities.
- The tests for all of the above, including the five `vi.mock("@base-ui/react/dialog", …)` paths:
  - `web/src/components/components.test.ts`;
  - `web/src/event/editor.test.ts`;
  - `web/src/event/details.test.ts`;
  - `web/src/calendars/calendars.test.ts`;
  - `web/src/account/notifications.test.ts`.
- `scripts/conventions.json`: the `ColorPicker` exception.
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

   Keep `finalFocus` on the menu button and the Escape guard. Under decision 2's `Drawer` branch, also check that a sideways swipe on the open drawer closes it, and that one on the view still steps the range.
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
9. **The exception.** Write `scripts/conventions.json` with the `ColorPicker` entry and its reason (decision 3).
10. **After.**
    - Take the screenshots again. The new markup may move a pixel; list every difference with its reason.
    - Run `check-base-ui` strict: rules 1-3 and 8-11 report 0.
    - Update [wiki/overlays.md](../../wiki/overlays.md), [wiki/decisions.md](../../wiki/decisions.md), [wiki/status.md](../../wiki/status.md) and [log.md](../../log.md).

## Acceptance

- [ ] `grep -rn "@base-ui/react" web/src --include=*.tsx --include=*.ts | grep -v "components/ui/" | grep -v "vi.mock"` prints nothing.
- [ ] `check-base-ui` strict reports 0 for rules 1, 2, 3, 9, 10 and 11. Rules 4-7 are left for brief 03, and their counts are in the outcome note.
- [ ] The drawer has a `Title` and `initialFocus`, and its Escape guard still lets Esc close a rename field inside it without closing the drawer. That is a test, not a manual check.
- [ ] `showToast()`'s signature is unchanged and every caller is untouched. A test shows a second toast replacing the first.
- [ ] Delete calendar can't be closed by Esc or ✕ while its request runs. That is a test.
- [ ] The time zone list and the weekday toggles work from the keyboard as listed in steps 7 and 8. Those are tests.
- [ ] The before and after screenshots match, with any difference listed and explained.
- [ ] `npm run check` passes, and `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 03 styles `web/src/components/ui/` with Tailwind on the parts, and removes the CSS rules this brief renamed.
- The skills library's `check-base-ui` heuristic for rule 9 may flag `Dialog.Close` around an icon. That is a false positive, to report to the skill rather than to except here.
