---
summary: How Almanac's phone notifications work end to end, built 2026-10-27. The VAPID config and the push routes, why a push goes out at high urgency with a one-hour TTL, the push-only service worker and what a tap opens, the Notifications dialog's states, the reminder field and how kind switches and edit scopes treat it, how a due time is worked out (all-day ones on the wall clock), the minute tick's window, claim-before-send, the message text, and what has not been tried on a real phone.
updated: 2026-11-01
---

# Notifications

Built on 2026-10-27 in three steps: the push plumbing, a reminder on each
event, then the sender. The product call is in [decisions.md](decisions.md),
"Reminders by Web Push, one per event"; the tables are in
[data-model.md](data-model.md). Satchel's push code (`satchel`) was the
reference, copied rather than depended on. The code wins where this page and
it disagree.

## Push

- **Config.** `config.push` is the three `VAPID_*` values or `undefined`. A
  partial set is a `ConfigError` naming the missing keys; the keys are checked
  for shape and for being one pair, and no message repeats a value. With none,
  the server logs once that push is off.
- **Keys.** `npm run vapid-keys -w @almanac/server` writes a pair into `.env`
  (created 0600), filling the empty lines copied from `.env.example`, and
  refuses to replace a pair. `-- --print` prints the three lines for the
  deploy's secrets. `VAPID_SUBJECT` stays the placeholder
  `mailto:johndoe@example.com` until the owner picks an address.
- **Routes** sit under `/api/push/` like every route: `GET key`,
  `PUT`/`DELETE subscriptions`, `POST test` (answers `{ sent }`). With push
  off the key, the save and the test answer 404, but the DELETE still answers
  204, so a browser can always drop its subscription (the owner's call,
  2026-10-27).
- **Sending.** `PushService.sendToUser(userId, payload)` in
  `server/src/push/push.ts` sends to each of the user's subscriptions, deletes
  any the push service answers 404 or 410 for, and never throws. `sender.ts`
  is Satchel's with **urgency high and a one-hour TTL** instead of normal and
  24 hours: a phone saving battery holds back a normal push, and a reminder
  that arrives hours late is noise. The payload is `PushPayload` in
  `shared/src/push.ts` (`title`, `body`, `url`, `tag`).

## The worker

`web/public/sw.js` is a plain classic script, not bundled TypeScript: `vite
dev` serves it as it is and the build copies it, so there is no wiring and no
question of module-worker support. It handles `push` and `notificationclick`
only, has no `fetch` handler and caches nothing, so there is still no offline
mode. It takes over at once and works out every URL from its scope.

On a tap it reuses the window already on the URL, else the one in front, else
any Almanac window, else opens one. When it can't move a window it posts
`almanac:open`, which the app handles (`web/src/push/subscription.ts`).
`sw.test.ts` runs the real file in a `vm` against a stand-in `self`; ESLint
gives it the worker's globals in its own block.

## The dialog

"Notifications" in the account menu (`web/src/account/Notifications.tsx`): a
Base UI `Switch`, and "Send a test" once it's on. Each state has its own line:
loading, not supported, the iPhone's Home Screen step, an iOS too old, blocked
(with where to lift it on a computer, Android and an iPhone), on, off, not set
up on this server, and a failed check with a retry. Permission is asked on the
press, never on load. Turning it off deletes the subscription on the server
first and then unsubscribes, so a failed delete leaves it on with an error.

## The reminder field

`reminderMinutes` on the API, `reminder_minutes` in the table, NULL for none.
The choices are `TIMED_REMINDERS` and `ALL_DAY_REMINDERS` in
`shared/src/event.ts`, with `remindersFor(allDay)` and `describeReminder`
("10 minutes before", "the day before at 09:00"); a value outside its kind's
list is a 400 naming the choices.

- **Switching kind.** A patch that turns an event all-day or timed without a
  `reminderMinutes` sets it to none (`apply` in `recurrence/scopes.ts`); one
  that gives a reminder has it checked against the new kind. The form's All
  day box and a drag between the all-day row and the time grid reset it too.
- **Edit scopes** treat it like the title: "all" changes the series and every
  exception that still had the old value, "this" writes it on the exception,
  "following" gives it to the new series and the later exceptions that had
  the old value. An exception set on its own keeps its value through an "all".
- **In the UI**, the event form has a Reminder row with a bell under the
  times, and the details popover says "Reminder: 10 minutes before" or
  nothing.

## Sending due reminders

`server/src/reminders/`: `due.ts` (`dueAt`, `findDue`), `message.ts`,
`sent-log.ts` (`reminders_sent`) and `timer.ts` (`createReminders`,
`startReminderTimer`).

- **Due time** comes from each occurrence's own kind, never its series', since
  "this and following" can leave a timed exception under an all-day series. A
  timed reminder is the start less the minutes in real time. An all-day one is
  00:00 of the start date in the user's display time zone, less the minutes
  **on the wall clock**, then turned into an instant. Subtracting 900 minutes
  from midnight's instant would put "on the day at 09:00" at 08:00 or 10:00 on
  the days the clocks change; the tests pin 09:00 across 2026-03-29 and
  2026-10-25.
- **The window** of a tick is `(from, to]`, `from` being the last tick's `to`
  but never more than 15 minutes back (`STALE_MS`). That one rule covers a
  restart and a server that slept, and means a night of downtime sends no
  stack of stale alerts. A failed tick leaves `from` alone, so the next one
  retries. Series with a reminder are expanded over the window plus a day;
  all-day rows are looked up by the dates from 10 hours before the window to
  16 hours after it, in the user's zone. Every query goes through the events
  store.
- **Once only.** A reminder is **claimed (`INSERT OR IGNORE` into
  `reminders_sent`) before it is sent**, not recorded after. Two ticks or two
  processes can't both send it, and a push that fails is not retried. Sent
  rows go after three days.
- **Who.** Only users with a push subscription
  (`PushSubscriptionStore.userIds()`), each about their own events.
- **The message.** "Dentist, 14:30" on the day, "Dentist, tomorrow at 14:30"
  from the day before, "Name day, today" or "Name day, tomorrow", judged at
  the moment it falls due in the user's zone. The body is the location. A tap
  opens `<base>day/y/m/d` (unpadded, the router's form) on the occurrence's
  date. The tag is unique per occurrence, so two reminders due together don't
  replace each other.
- **Lifecycle.** `buildApp` starts the timer only while push is on and
  `REMINDER_TIMER` isn't `off`. The first tick runs a minute after start; a
  tick still running is never overlapped. The `onClose` hook stops the timer
  and waits for a running tick. Fastify runs a closing app's hooks last-added
  first, so this happens before the database closes. A second process on the
  same database would set `REMINDER_TIMER=off`, though the claim keeps even
  two from double-sending.

## Not tried yet

A real phone. A real Web Push reached FCM from the built server on this
machine (2026-10-27), but no desktop browser or phone has shown one, and
production push is off until `vps-deploy`'s Almanac stack passes the
`VAPID_*` values ([status.md](status.md)).

Known: changing a reminder after it was sent doesn't send it again, because
the sent log is keyed by the occurrence; moving the event does, since its new
start is a new key.
