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
