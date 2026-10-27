# Task 14: Phone notifications, part 1: the worker and the push subscription

## Context

Promoted 2026-10-23 from the todo
[phone-notifications](../../todos/phone-notifications.md), the owner's first
follow-up after v1 ([decisions.md](../../wiki/decisions.md), "No reminders in
v1"). The todo splits into three briefs, built in order:

- **14 (this one):** a service worker that can show a push, a subscription the
  server stores, and a test notification;
- **15:** a reminder on each event;
- **16:** the server timer that sends due reminders.

Almanac has a web manifest (`web/public/manifest.webmanifest`, linked from
`web/index.html`) and **no service worker** (checked 2026-10-23). On iPhone, Web
Push works only for a web app added to the home screen.

Satchel already does all of this (`../satchel`), and its code is the reference
to copy, not a package to depend on:

- server: `web-push` 3.6.7, `server/src/push/sender.ts` (`webPushSender`,
  `PUSH_TTL_SECONDS`, `PUSH_TIMEOUT_MS`), the `push_subs` table and its store
  methods in `server/src/store.ts`, the routes in `server/src/routes/push.ts`,
  and `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` in `.env.example`;
- web: `web/src/push/subscription.ts` (`pushSupport`, `isIos`,
  `base64UrlToBytes`), `web/src/settings/Notifications.tsx`, and `web/src/sw.ts`.

Satchel's worker also precaches the app shell (vite-plugin-pwa, injectManifest).
Almanac's worker does **not**: it handles `push` and `notificationclick` only,
and has no `fetch` handler, so nothing about how Almanac loads changes.

## Files you OWN

- `server/src/config.ts`, `config.test.ts` (the three VAPID settings; push is off
  when they are unset)
- `server/src/db/migrations.ts` (a **new** migration at the end:
  `push_subscriptions`)
- `server/src/store/` (the subscription methods), `server/src/routes/push.ts` and
  its test, `server/src/app.ts` (registering the routes)
- `server/package.json` (`web-push` and `@types/web-push`, exact pins as Satchel's)
- `web/src/push/` (new), the worker file and how it is built, `web/src/main.tsx`
  (registering it)
- `web/src/layout/AccountMenu.tsx` (a "Notifications" entry) and a
  `web/src/account/Notifications.tsx` dialog
- `shared/src/` (the request/response schemas for the push routes)
- `.env.example`, `docs/` (the owner's step to generate the keys), corpus outcome,
  `status.md`, `log.md`

## Files you must NOT touch

- `server/src/routes/events.ts`, `occurrences.ts`, `recurrence/` (briefs 15 and 16).
- `../satchel`: copy from it, never import it.

## What to do

1. Config: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. All three or
   none; with none, the push routes answer `404` and the dialog says notifications
   are not set up on this server.
2. `GET /push/key` (the public key), `PUT /push/subscriptions` (save this browser's
   subscription for the signed-in user; at most a handful per user, oldest dropped),
   `DELETE /push/subscriptions` (by endpoint), `POST /push/test` (send "Almanac
   notifications are on" to the caller's subscriptions). All behind the session.
3. A subscription the push service answers `404`/`410` for is deleted.
4. The worker shows the payload as a notification and, on a click, focuses an open
   Almanac tab or opens one at the URL in the payload.
5. The dialog: a switch to turn notifications on in this browser (asks permission
   on the press, never on load), a "Send a test" button, and plain words for each
   state: not supported, needs adding to the home screen first (iPhone), blocked in
   the browser's settings, on, off.
6. A script or documented command to generate VAPID keys into `.env` (Satchel's
   docs show one).

## Acceptance

- On a desktop browser and on an iPhone with Almanac on the home screen, turning
  notifications on and pressing "Send a test" shows the notification; tapping it
  opens Almanac.
- Turning it off deletes the subscription on the server.
- With no VAPID keys in `.env`, the server starts and the dialog says why it can't.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.

## Outcome (2026-10-27)

Done in `a037849`. `web-push` 3.6.7 and `@types/web-push` 3.6.4 are pinned in
`server/package.json`, as Satchel's.

- **Config.** `config.push` is the three `VAPID_*` values or `undefined`. A
  partial set is a `ConfigError` naming the missing keys, as a partial Ward
  set is. The keys are checked for their shape and for being one pair, and no
  message repeats a value. With none the server logs once that push is off.
- **Storage.** Migration 2 adds `push_subscriptions`, keyed by endpoint.
  Saving gives the endpoint to whoever saved it last, and a user keeps their
  newest five (`PUSH_SUBSCRIPTIONS_PER_USER`). Rows go with the user.
- **Routes.** They are under `/api/push/`, like every other route, so not the
  brief's bare `/push/...`: `GET /api/push/key`,
  `PUT`/`DELETE /api/push/subscriptions` and `POST /api/push/test`
  (`{ sent }`). With push off the key, the save and the test are 404.
  **DELETE still works then**, as Satchel's does, so a browser can always
  clean up. The brief said all of them 404; this is the one change.
- **Sending.** `server/src/push/push.ts` is on `FeatureContext.push`.
  `sendToUser(userId, payload)` sends to every subscription, deletes one the
  push service answers 404 or 410 for, and never throws. Brief 16 calls it.
  `sender.ts` is Satchel's with urgency high and a one-hour TTL, not normal
  and 24 hours: a phone saving battery holds back a normal push, and a late
  reminder is noise. The payload is `PushPayload` in `shared/src/push.ts`
  (`title`, `body`, `url`, `tag`).
- **The worker** is `web/public/sw.js`, a plain classic script. It is not a
  bundled TypeScript file: `vite dev` serves it as it is and the build copies
  it, so there is nothing to wire up and no question of module-worker support.
  It handles `push` and `notificationclick` only, takes over at once, and
  works out every URL from its scope. On a press it reuses the window already
  on the URL, else the one in front, else any Almanac window. It falls back to
  a message the app handles (`almanac:open`) when it can't move a window.
  `sw.test.ts` runs the real file in a `vm` against a stand-in `self`.
  `eslint.config.js` gained a block giving it the worker's globals.
- **The dialog** is `account/Notifications.tsx`, under "Notifications" in the
  account menu. It has a Base UI `Switch`, "Send a test" once on, and its own
  line for loading, not supported, the iPhone's Home Screen step, an iOS too
  old, blocked (with where to lift it on a computer, Android and an iPhone),
  on, off, not set up on this server, and a failed check with a retry.
  Turning it off deletes the subscription on the server first, then
  unsubscribes, so a failed delete leaves it on with an error.
- **Keys.** `npm run vapid-keys -w @almanac/server` writes a pair into `.env`
  (created 0600). It fills the empty lines copied from `.env.example` and
  refuses to replace a pair. `-- --print` prints the three lines for the
  deploy's secrets. `VAPID_SUBJECT` defaults to the placeholder
  `mailto:johndoe@example.com`. The steps are in `docs/getting-started.md`
  ("Try notifications") and `docs/owner-setup.md` (step 8).

Checked: typecheck, lint, the build, and 694 tests (76 new). The route tests
mock web-push's `sendNotification` and use a key pair made at run time, so no
pair is written into a file. In headless Chromium against a scratch account
and database: the worker registers at `/almanac/sw.js` with scope `/almanac/`
and controls the page. With no keys the dialog says notifications aren't set
up on this server. With a throwaway pair in the server's environment it shows
the switch, and pressing it shows the blocked state, because headless
Chromium denies permission. The script was run against a scratch `.env`.

**Not checked live:** the acceptance's desktop and iPhone runs (turn on, Send
a test, the notification shows, a tap opens Almanac) and the delete on turning
off from a real browser. Nothing here reaches FCM or Apple's push service, and
no phone was used. The route tests cover the server's half.

**Left for the owner:**

- `../vps-deploy/stacks/almanac.ts` passes no `VAPID_*` value to the
  container, so production push stays off until the three lines are added
  there the way `stacks/satchel.ts` does it. That is another repo, so it
  wasn't touched.
- `VAPID_SUBJECT` needs a real contact address in production.
- `web/index.html`'s comment "no service worker, no offline" is out of date.
  It isn't this brief's file.
