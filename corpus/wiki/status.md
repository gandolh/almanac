---
summary: Snapshot as of 2026-11-01, per area. v1 built 2026-10-16 and reviewed; Base UI under the overlays 2026-10-23; phone notifications (push worker, a reminder on each event, the minute sender) 2026-10-27. Pushed to GitHub through 2026-11-01, nothing deployed, no phone has shown a notification. What waits on the owner, open bugs, accepted known issues, and the todos.
updated: 2026-11-01
---

# Status

_2026-11-01_. Everything below is on `main` and pushed to
`https://github.com/<owner>/almanac.git`. Nothing is deployed. No brief is
open; brief numbering restarted at 01 on 2026-11-01 (see
[log.md](../log.md)).

## By area

- **Server and data** (2026-10-16, notifications tables 2026-10-27).
  Fastify + SQLite, the vendored Ward library for local login and Sign in with
  Ward, several private users, no sign-up. Schema in
  [data-model.md](data-model.md), routes and gating in
  [architecture.md](architecture.md).
- **Repeating events** (2026-10-16). Presets, three edit scopes, expansion on
  the server with rrule-temporal; the Bucharest DST weeks pass
  ([recurrence.md](recurrence.md)).
- **Web app** (2026-10-16). Day, week and month on FullCalendar v7, our own
  year view, quick create and the event form, calendars, display time zone,
  search, keyboard shortcuts, phone layout with drawer and swipe
  ([web-app.md](web-app.md), [features.md](features.md)).
- **Overlays** (2026-10-23). `Dialog`, `Popover`, `Menu` and the phone drawer
  on Base UI 1.9.0 ([overlays.md](overlays.md)).
- **Notifications** (2026-10-27). Web Push plumbing, a reminder on each event,
  and the minute tick that sends them. A real push reached FCM from the built
  server on this machine; no browser or phone has shown one yet
  ([notifications.md](notifications.md)).
- **Deploy and docs** (2026-10-16). Docker image and compose file here, the
  stack in `vps-deploy` and the seed entry in `wzd_auth`, all committed; the
  README and `docs/` follow the readme-docs standard (images retaken
  2026-10-31). The stack doesn't pass the `VAPID_*` values yet.
- **Sibling repos** (2026-10-27). The stale app lists in `wzd_auth` and
  `shelfmark` that the deploy work left behind were fixed; both are pushed.

Built with `plan-split-dispatch`, one commit per piece, then three code
reviewers and browser walkthroughs on 2026-10-16, the findings fixed in
three lanes.
745 tests; typecheck, lint and build clean.

## Next (owner)

1. Register Almanac in production Ward and write
   `vps-deploy/secrets/almanac.env` with `WARD_OIDC_CLIENT_KEY` (the only
   key), then deploy, following [docs/owner-setup.md](../../docs/owner-setup.md).
2. Create your account with the seed inside the container. Sign in locally
   first, then link Ward from the account menu, or Ward creates a second,
   empty user.
3. Grant your Ward account (and anyone else who should have a calendar) the
   `almanac` app in Ward's console.
4. Not tried here: the "Sign in with Ward" round trip, locally (needs the
   local Ward seed with Docker Desktop's WSL integration on) or in
   production; adding it to a phone's home screen.
5. Notifications: add the three `VAPID_*` values to
   `vps-deploy/stacks/almanac.ts` (as `vps-deploy/stacks/satchel.ts`
   has them), make a pair and put it in `vps-deploy/secrets/almanac.env`
   with a real `VAPID_SUBJECT`, then deploy both halves, following
   [docs/owner-setup.md](../../docs/owner-setup.md) step 8. Then turn
   Notifications on in a desktop browser and on the iPhone's Home Screen app,
   and press "Send a test". Then give a real event two minutes out the
   reminder "At the start" and check it shows on time.

## Open

- On a phone the search field covers the top bar, but the bar's buttons
  under it stay in tab order: `TopBar` has no `inert` while search is open.
- The search field's width between 768 and 1200 px hasn't had a browser
  look.

## Known and accepted

- A repeating event at a wall-clock time inside the spring-forward hour
  (03:00-04:00 on the last Sunday of March in Bucharest) skips that day
  ([recurrence.md](recurrence.md)).
- Changing the time or repeat of "all" or "following" drops exceptions and
  deleted dates, as Google does.
- Esc from search returns to the last calendar view visited.
- Date fields in the event form follow the browser's locale format.
- In a font wider than Roboto or San Francisco, a phone week title across
  two years ("Dec ’26–Jan ’27") can lose a few pixels at the end.
- `npm run dev` can fail with `ENOSPC` when VS Code holds most file
  watchers; the polling workaround is in
  [docs/getting-started.md](../../docs/getting-started.md#common-problems).
- The first quick-create event in the very first browser walk seemed to
  vanish once; it never reproduced in later runs.
- A reminder already sent isn't sent again when only the reminder is changed
  afterwards (the sent log is keyed by the occurrence); moving the event
  sends it again at the new time.
- Three small differences from the hand-built overlays were kept
  ([overlays.md](overlays.md)).

## Todos

None open.
