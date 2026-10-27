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

## Outcome (2026-10-27)

Done in `41ee4c4`.

- **The module** is `server/src/reminders/`. `due.ts` has `dueAt`, the window's
  lookahead and `findDue`; `message.ts` writes the notification; `sent-log.ts`
  keeps `reminders_sent`; `timer.ts` has `createReminders` (one `tick`) and
  `startReminderTimer`.
- **Due times** come from each occurrence's own kind, so a timed exception
  under an all-day series counts as timed. A timed reminder is the start less
  the minutes in real time. An all-day one is 00:00 of the start date less the
  minutes **on the wall clock** in the user's display zone, then turned into an
  instant. Taking 900 minutes off midnight's instant would put "on the day at
  09:00" at 08:00 or 10:00 on the day the clocks change. The tests pin
  09:00 for both choices on 2026-03-29 and 2026-10-25 and the days either side.
- **The window** of a tick is `(from, to]`, with `from` the last tick's `to`
  but never more than 15 minutes back, which covers both a restart and a server
  that was asleep. A tick that fails leaves `from` where it was, so the next
  one retries the window. Series with a reminder are expanded only over the
  window plus a day (the end is exclusive, so a millisecond more). All-day
  rows are looked up by the dates from 10 hours before the window to 16 hours
  after it, in the user's zone. Every event query goes through the events
  store, so the store is still the only module that runs SQL on `events`.
- **Once only.** `reminders_sent` (migration 4) is keyed by the event row and
  the occurrence's start: the series and its key for a generated occurrence,
  the row and its start for a one-off or an exception. Rows go with their
  event and are dropped after three days. A reminder is **claimed (`INSERT OR
  IGNORE`) before it is sent**, not recorded after, as the brief worded it.
  That keeps two ticks or two processes from both sending it, and a push
  that fails is not retried, as brief 14's aren't.
- **Who is told:** only users with a push subscription
  (`PushSubscriptionStore.userIds()`, added to brief 14's store), each about
  their own events.
- **The message:** "Dentist, 14:30" on the day, "Dentist, tomorrow at 14:30"
  from the day before, "Name day, today" or "Name day, tomorrow". The day is
  judged at the moment the reminder is due, in the user's zone. The location
  is the body. The click opens `<base>day/y/m/d` (unpadded, the router's form)
  on the occurrence's start date. The tag is unique per occurrence, so two
  reminders due together don't replace each other.
- **Lifecycle.** `REMINDER_TIMER` (on unless `off`) is in the config and in
  `.env.example`. `buildApp` starts the timer only while push is on. The first
  tick is a minute after start and looks back 15 minutes. A tick still running
  is not overlapped. `onClose` stops the timer and waits for a running tick:
  Fastify runs a closing app's hooks last added first, so this runs before the
  database closes. `index.ts` needed no change, because its signal handlers
  already close the app.

Files touched outside the brief's list: `store/push-subscriptions.ts` and its
test (`userIds`), and `.env.example` (the switch).

Checked: typecheck, lint, the build, and 745 tests (31 new). The fake-clock
tests run the module on a second connection to a test app's database, with
events made through the API and a stand-in push service. They cover:

- the acceptance: a 10-minute reminder sent once at start less 10 minutes; a
  weekly series sent once per occurrence across the end of summer time; the
  day before at 09:00 in Bucharest either side of a clock change; two ticks,
  and two processes, over one window sending once; a restart 5 minutes after
  a reminder fell due sending it, and 30 minutes after not;
- at the start; a day before ("tomorrow at"); an occurrence's own reminder,
  and one set to none; an occurrence moved on its own; a deleted, moved or
  re-timed event; a busy server skipping what is over 15 minutes late; the
  sent log's pruning; users without a subscription skipped; another user's
  zone;
- the timer's minute, the skipped overlapping tick, a failed tick logged, and
  stop waiting for a running tick.

Live, on this machine: the built server with a throwaway VAPID pair in its
environment and a made-up FCM subscription. Its first tick sent the reminder
of an event that fell due 12 minutes before (the restart rule). An event with
"at the start" at 20:03:00Z went out at 20:03:03 in the tick after. Both were
real Web Push requests: FCM answered 410 for the made-up device, and the
subscription was deleted.

**Not checked:** the acceptance's phone run, where a real event 2 minutes out
shows the notification on time. That needs brief 14 deployed with VAPID keys
(the vps-deploy step in [status.md](../../wiki/status.md)) and a phone.

Known: changing an occurrence's reminder after it has been sent doesn't send
it again, since the log is keyed by the occurrence and not by the reminder.
Moving the event does, because the new start is a new key.
