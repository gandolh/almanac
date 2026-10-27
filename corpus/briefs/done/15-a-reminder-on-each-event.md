# Task 15: Phone notifications, part 2: a reminder on each event

## Context

Promoted 2026-10-23 from the todo
[phone-notifications](../../todos/phone-notifications.md). Part 2 of three: 14
sets up push, this one stores when to remind, and 16 sends it. Nothing is sent
until 16 lands. Independent of 14, so it can be built before or after it.

The `events` table ([`server/src/db/migrations.ts`](../../../server/src/db/migrations.ts))
has timed events (`start_at`, UTC epoch ms) and all-day ones (`start_date`,
`YYYY-MM-DD`). Times show in the user's time zone from `user_settings`. Series
are expanded by [`server/src/recurrence/expand.ts`](../../../server/src/recurrence/expand.ts),
and "this / this and following / all" edits by `server/src/recurrence/scopes.ts`.

The choices below are picked to match what phone calendars offer; the owner can
change the list.

- **One reminder per event**, off by default.
- Timed events: at the start, 5, 10, 15 or 30 minutes before, 1 or 2 hours
  before, 1 day before.
- All-day events: on the day at 09:00, or the day before at 09:00, in the user's
  time zone.
- A series' reminder applies to every occurrence. An occurrence edited on its own
  carries its own value, like any other field.

## Files you OWN

- `server/src/db/migrations.ts` (a **new** migration at the end:
  `reminder_minutes INTEGER` on `events`, NULL = none; for all-day events the
  value counts minutes before 00:00 of the start date, so 900 is 09:00 the day
  before and -540 is 09:00 on the day)
- `shared/src/event.ts`, `event.test.ts` (the field and its allowed values)
- `server/src/store/` (reading and writing it), `server/src/routes/events.ts` and
  its test
- `server/src/recurrence/scopes.ts` (only if a scoped edit needs to carry the
  field), and its test
- `web/src/event/EventForm.tsx`, `editor-state.ts` and their tests (a "Reminder"
  select under the time fields), `web/src/event/DetailsPopover.tsx` (shows it)
- corpus outcome, `status.md`, `log.md`

## Files you must NOT touch

- `server/src/routes/push.ts` and `web/src/push/` (brief 14).
- Anything that sends (brief 16).

## What to do

1. Migration, schema and store as above. The schema accepts only the listed values
   for each kind of event; switching an event between timed and all-day resets
   the reminder to none.
2. The form's select lists the choices for the event's kind, with "None" first.
3. The details popover shows "Reminder: 10 minutes before" (or nothing when none).
4. Scoped edits of a series ("this and following", "all") carry the reminder like
   any other field.

## Acceptance

- A timed event saved with "10 minutes before" reads back with 10; an all-day event
  with "the day before at 09:00" reads back with 900.
- A value outside the list is a `400`.
- Changing a series' reminder for "all" changes every occurrence; for "this" only
  that one.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.

## Outcome (2026-10-27)

Done in `8c6df82`, with the choices as the brief lists them. Nothing is sent
yet; that is brief 16.

- **Storage.** Migration 3 adds `events.reminder_minutes`, NULL for none,
  with no CHECK: the list is the schema's, as the colours are, so it can change
  without rebuilding the table.
- **The field** is `reminderMinutes` on the API, on `EventInput`, on a
  patch's `changes` and on every `Occurrence`. `TIMED_REMINDERS` is
  `[0, 5, 10, 15, 30, 60, 120, 1440]` and `ALL_DAY_REMINDERS` is
  `[-540, 900]`, both in `shared/src/event.ts`, with `remindersFor(allDay)`
  and `describeReminder` ("10 minutes before", "the day before at 09:00").
  A value that isn't in its kind's list is a 400 naming the choices.
- **Switching kind.** A patch that turns an event all-day or timed without a
  `reminderMinutes` sets it to none (`apply` in `recurrence/scopes.ts`). One
  that gives a reminder has it checked against the new kind. The form's All
  day box resets the select to None either way. A drag between the all-day row
  and the time grid sends no reminder, so it is reset too.
- **Scopes.** `reminderMinutes` is one of the fields an edit carries, like the
  title: "all" changes the series and every exception that still had the old
  value, "this" writes it on the exception only, and "following" gives it to
  the new series and to the exceptions after the split that had the old
  value. An exception set on its own keeps its value through an "all".
- **Web.** The event form has a Reminder row with a bell, under the times and
  above the repeat. Its select lists None and the choices for the event's
  kind. The details popover says "Reminder: 10 minutes before" under the
  repeat line, or nothing.

Files touched outside the brief's list: `recurrence/expand.ts` (`contentOf`,
`rowOccurrence` and `seriesOccurrence` carry the field; nothing about
expanding changed), `components/icons.tsx` (`BellIcon`), `event/editor.css`
(the select's width), and the `Occurrence` and `EventContent` fixtures in the
server and web tests.

Checked: typecheck, lint, the build, and 714 tests (20 new: the schema's list
and words, the routes' read-back, 400s and the reset on switching kind, and
the three scopes on a series). In headless Chromium against a scratch account:
the select's choices change with All day and go back to None. A timed event
saved with "10 minutes before" reads back 10 from `/api/occurrences`. Its
details say "Reminder: 10 minutes before", and the edit form opens on 10. The
scopes on a series were checked through the API tests, not in the browser.

For brief 16:

- An exception has its own `all_day` and `reminder_minutes`, and "this and
  following" can leave a moved timed exception under an all-day series. Work
  out each row's due time from that row's own kind, never its series'.
- An all-day reminder counts from 00:00 of the start date in the user's
  display time zone (`user_settings`), not in the series' `tzid`. This brief
  stores only the minutes.
