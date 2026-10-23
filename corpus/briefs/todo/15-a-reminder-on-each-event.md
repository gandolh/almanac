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
