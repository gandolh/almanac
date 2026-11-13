---
summary: Snapshot as of 2026-11-13, per area. v1 built 2026-10-16 and reviewed; Base UI under the overlays 2026-10-23; phone notifications (push worker, a reminder on each event, the minute sender) 2026-10-27; the estate's conventions (house style, Base UI rules, Tailwind, the server structure) filed as briefs 01-04 on 2026-11-09, the house style and its harness (brief 01) built 2026-11-11, Base UI by the conventions (brief 02) and the whole web app on Tailwind with a Light / Dark / System switch (brief 03) built 2026-11-11, the server grouped by feature with a schema on every route (brief 04) built 2026-11-12, the redesign (brief 05: Almanac's own look on the familiar layout, a phone week strip and bottom bar, Playwright specs) built 2026-11-13, the calendar feed (brief 06: a private read-only .ics link per user for a phone's calendar app) built 2026-11-13. Pushed to GitHub through 2026-11-01, nothing deployed, no phone has shown a notification. What waits on the owner, open bugs, accepted known issues, and the todos.
updated: 2026-11-13
---

# Status

_2026-11-09_. Everything below is on `main` and pushed to
`https://github.com/<owner>/almanac.git` as of 2026-11-01. Nothing is
deployed. Briefs 01-06 are built (01-03 on 2026-11-11, 04 on 2026-11-12, 05 and 06 on 2026-11-13); brief numbering
restarted at 01 on 2026-11-01 (see [log.md](../log.md)).

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
- **Overlays** (2026-10-23, widened 2026-11-11). `Dialog`, `Popover`, `Menu`
  and the phone drawer on Base UI 1.9.0; since 2026-11-11 also the toast, the
  delete-calendar confirm, the time zone list, the weekday toggles, the colour
  palette and the notifications switch, all wrapped under
  `web/src/components/ui/` ([overlays.md](overlays.md)).
- **Notifications** (2026-10-27). Web Push plumbing, a reminder on each event,
  and the minute tick that sends them. A real push reached FCM from the built
  server on this machine; no browser or phone has shown one yet
  ([notifications.md](notifications.md)).
- **Deploy and docs** (2026-10-16). Docker image and compose file here, the
  stack in `vps-deploy` and the seed entry in `wzd_auth`, all committed; the
  README and `docs/` follow the readme-docs standard (images retaken
  2026-10-31). The stack doesn't pass the `VAPID_*` values yet.
- **Conventions** (2026-11-11). The house style and its harness are built
  (brief 01): vendored `house-style` 1.0.0, Prettier at 120, the typed ESLint
  rules, `npm run check` and `check:fast`, a root `CLAUDE.md` and
  `.claude/rules/`. Brief 02 (Base UI by the base-ui skill's rules) and brief
  03 (the whole web app on Tailwind 4.3.5, one stylesheet, the Light / Dark /
  System switch) are built; `check-base-ui` runs strict with two recorded
  exceptions (FullCalendar's sheet, the calendar colour). Brief 04 (the server
  layout) is built (2026-11-12): features/, plugins/, a schema on every route,
  `check-structure` and dependency-cruiser strict. Base UI is pinned at 1.9.0.
- **Redesign** (2026-11-13). Brief 05 gave the web app its own look: olive
  greys on raised cards, a moss accent, Sofia Sans and Sofia Sans Condensed,
  per-theme calendar colours, a 56 px header band over a 276 px column with the
  chosen day's list, a phone week strip over an agenda with a bottom view bar,
  the details as a bottom sheet on a phone, and the event form with visible
  labels. Recorded in [web/DESIGN.md](../../web/DESIGN.md) and
  [decisions.md](decisions.md). Playwright specs (`web/e2e`, three theme
  projects) and `scripts/contrast.mjs` came with it. Built, not deployed.
- **Calendar feed** (2026-11-13). Brief 06: Calendar feed… in the account
  menu turns on one private, read-only `.ics` link per user that a phone's
  calendar app subscribes to (every calendar, no alarms, the link shown once
  and kept as a hash, 30 fetches a minute per address). Built, not deployed;
  no phone has subscribed yet ([calendar-feed.md](calendar-feed.md)).
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
6. The redesign (brief 05) is web-only: `node cli.ts almanac deploy` from the
   `vps-deploy` checkout ships it. Look at the week on a phone and the details
   sheet on Android first.
7. The calendar feed (brief 06) changes both halves and adds a table:
   `node cli.ts almanac all` from the `vps-deploy` checkout (it ships brief
   05's web app too). Then [docs/owner-setup.md](../../docs/owner-setup.md)
   step 9: turn it on, copy the link, add it in ICSx⁵ on the Android phone,
   and check an event and a repeating one show at the right times. Answer the
   board's question on almanac-06: keep the link shown once, or show it again
   any time.

## Open

- On a phone the search field covers the top bar, but the bar's buttons
  under it stay in tab order: `TopBar` has no `inert` while search is open.
- The README's images still show the old look (the redesign came after the
  last retake, 2026-10-31); retake them with `docs/images/shots.md`.
- The calendar keys other than blue, green, orange and
  purple (teal, olive, yellow, red, pink, graphite) take their per-theme colours
  from the OKLCH recipe, not from a drawn comp; `shared/src/calendar.ts` still
  holds Google's shades.

## Known and accepted

- A repeating event at a wall-clock time inside the spring-forward hour
  (03:00-04:00 on the last Sunday of March in Bucharest) skips that day
  ([recurrence.md](recurrence.md)).
- Changing the time or repeat of "all" or "following" drops exceptions and
  deleted dates, as Google does.
- Esc from search returns to the last calendar view visited.
- Date fields in the event form follow the browser's locale format.
- In a font wider than Sofia Sans or San Francisco, a phone week title across
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
- Tailwind 4's `hover:` applies only where the device can hover, so a tap on a
  phone no longer leaves a hover state behind (the Create button, a dialog's
  primary action).

## Todos

- [Almanac's events on the phone's calendar](../todos/almanac-events-on-the-phone-calendar.md) (2026-11-13): promoted to brief 06 the same day and built.
