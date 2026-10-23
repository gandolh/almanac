# Task 16: Phone notifications, part 3: send due reminders

## Context

Promoted 2026-10-23 from the todo
[phone-notifications](../../todos/phone-notifications.md). Part 3 of three. **Run
it after 14 and 15**: it sends through 14's subscriptions the reminders 15 stores.

The server is one Fastify process ([`server/src/index.ts`](../../../server/src/index.ts))
with SQLite. It has no timer today. Series occurrences exist only when expanded
([`server/src/recurrence/expand.ts`](../../../server/src/recurrence/expand.ts),
`MAX_OCCURRENCES_PER_SERIES = 1000`).

## Files you OWN

- `server/src/reminders/` (new): finding due reminders, the timer, the sent log
- `server/src/db/migrations.ts` (a **new** migration at the end: `reminders_sent`,
  keyed by event id and occurrence start, so nothing is sent twice)
- `server/src/index.ts` and `server/src/app.ts` (starting and stopping the timer)
- `server/src/config.ts` (a switch to turn the timer off, for tests and for a
  second process)
- corpus outcome, `status.md`, `log.md`, and `corpus/wiki/decisions.md` (replace "No
  reminders in v1" with what shipped)

## Files you must NOT touch

- `server/src/routes/push.ts`, `web/src/push/` (14) and the reminder field (15),
  except to call them.
- `server/src/recurrence/expand.ts`: call it, don't change it.

## What to do

1. Once a minute, find every reminder due in the window since the last run: timed
   events by `start_at - reminder_minutes`, all-day events by 00:00 of the start
   date in the user's time zone minus the minutes, and series by expanding only
   the window that can hold a due reminder (look ahead by the largest reminder
   offset, one day).
2. For each, skip it if `reminders_sent` has it; otherwise send the event's title
   and time ("Dentist, 14:30" / "Name day, tomorrow") to every subscription the
   user has, with a click URL that opens the event's day, then record it.
3. After a restart, send what fell due in the last 15 minutes and skip anything
   older, so a server down overnight doesn't fire a stack of stale alerts.
4. Drop `reminders_sent` rows older than a few days.
5. Deleting an event or changing its time or reminder before it fires means the
   old reminder never fires; that falls out of computing from the current rows.
6. Stop the timer on Fastify's `onClose`.

## Acceptance

- With a fake clock: a timed event with a 10-minute reminder sends once at
  start − 10 min; a weekly series sends once per occurrence; an all-day event with
  "day before" sends at 09:00 the day before in the user's zone (check across a
  DST change in Bucharest).
- Two ticks over the same window send once.
- A restart 5 minutes after a reminder fell due sends it; 30 minutes after, not.
- On a phone with notifications on from brief 14, a real event 2 minutes out with
  "at the start" shows the notification on time.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.
