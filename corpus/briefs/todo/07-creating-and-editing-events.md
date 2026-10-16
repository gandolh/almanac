# Task 07: Creating and editing events

## Context

Replace the `EventEditor` stub with quick create and the full event form,
Google style. Read [features.md](../../wiki/features.md) ("Interactions",
"Events"), [glossary.md](../../wiki/glossary.md) (quick create, event form,
series, edit scope) and [recurrence.md](../../wiki/recurrence.md) ("Edit
scopes").

Depends on: 05 (stub signature, Popover, Dialog, Toast, `dates.ts`,
`useCalendars`, `useSettings`, `registerCommand`), 06 (`data/occurrences.ts`
writes, `askScope`). Brief 04 handed back the scope rules; the essentials: a
change to the repeat rule can't use "this event"; "this and following" on
the first occurrence acts as "all".

## Files you OWN

```
web/src/event/EventEditor.tsx   (replaces the stub, same exports)
web/src/event/QuickCreate.tsx  web/src/event/EventForm.tsx  web/src/event/RepeatPicker.tsx
web/src/event/TimeField.tsx  web/src/event/editor-state.ts  web/src/event/editor.css
web/src/event/*.test.ts         (for these files)
```

## Files you must NOT touch

`web/src/event/DetailsPopover.tsx`, `scope.tsx`, `linkify.tsx` (brief 06),
`web/src/calendar/*`, `web/src/layout/*`, `server/`, `shared/`.

## What to do

1. **`EventEditorProvider` / `useEventEditor()`** keep the stub's exact
   signature. Register the "create" command (the `c` key) to `openCreate()`.
2. **Quick create** (`openQuickCreate`): a popover anchored to the selection
   on desktop with: a title field (focused), the time as text ("Friday, 16
   October · 10:00 – 11:00" or "All day"), the calendar picker, Save, and
   "More options" which opens the event form with what was typed. Enter
   saves. Esc or a click outside discards. Below 768 px skip the popover and
   open the event form.
3. **Event form** (`openCreate`, `openEdit`, "More options"): a `Dialog`
   (full screen on a phone) with title; start date and time, end time and
   end date; All day; repeat (`RepeatPicker`); calendar; location; notes.
   Save, Cancel, and Delete when editing.
   - New events from `openCreate()` start at the next full hour today in the
     display time zone and last an hour.
   - Changing the start moves the end to keep the duration. An end before
     the start is refused inline.
   - An empty title saves as "(No title)", as Google does.
   - `TimeField`: type "14:30" or "1430", or pick from a list in 15-minute
     steps, 24-hour labels; the end time's list shows durations ("11:00 (1
     hr)").
   - Dates use `<input type="date">`; times are always 24-hour.
4. **RepeatPicker**: "Does not repeat", "Daily", "Weekly on <weekday>",
   "Every weekday (Monday to Friday)", "Monthly on day <n>", "Annually on
   <date>", "Custom days…" (toggle M T W T F S S). When repeating: ends
   Never, On <date>, After <n> occurrences. Labels follow the start date.
   Built on the shared repeat types; the summary text uses `describeRepeat`.
5. **Saving**: new events go through `createEvent`. Editing a one-off saves
   directly. Editing an occurrence of a series asks `askScope({ action:
   "edit", allowThis: !repeatChanged })`, then `updateEvent(eventId, {
   scope, occurrence: originalStart, changes })` with only the changed
   fields. Deleting asks the scope for a series. Server validation errors
   show inline; a failure keeps the form open with what was typed.
6. **Default calendar**: the last calendar used (kept in `localStorage`,
   wrapped in try/catch), else the first visible one.
7. Tests (Node, `renderToStaticMarkup` and pure functions in
   `editor-state.ts`): default start and end, duration keeping, time parsing,
   repeat labels for a few start dates, which fields count as changed,
   `allowThis` false when the repeat changed.

## Acceptance

- typecheck, lint, `npx vitest run web` and build pass.
- In the browser: drag across Tuesday 10:00-11:30 in week view, type a title,
  Enter: the event appears. "More options" carries the title over. `c` opens
  the form. Make a weekly series, edit one occurrence with "This event" and
  the rest stay; change the repeat and only the two broader scopes are
  offered.
