---
summary: Snapshot as of 2026-10-16. v1 is built - all 11 briefs done and committed on main, then a review round (three code reviewers and two browser walkthroughs) with two fix rounds. Pushed to gandolh/almanac on GitHub, not deployed. Brief 12 (Base UI under the overlays) built 2026-10-23; briefs 14-16 (phone notifications: the push worker, a reminder on each event, sending them) built 2026-10-27, local, 745 tests. What waits on the owner, one line per brief, accepted known issues, and the todos by tier.
updated: 2026-10-27
---

# Status

_2026-10-16_. v1 is built. The owner settled the design in a grill
([decisions.md](decisions.md), [features.md](features.md)); the 11 briefs
were built the same day with `plan-split-dispatch`, one commit per brief on
`main`, then reviewed by three code finders (web wiring, server
correctness, conventions) and a browser walkthrough of every flow, and the
findings were fixed in three lanes, re-checked in the browser, and the last
three leftovers fixed after a pause. 623 tests pass; typecheck, lint and
build are clean. `main` is pushed to `https://github.com/gandolh/almanac.git`,
and so is `../wzd_auth`'s local seed entry (`22e1fd2`). `../vps-deploy` has
no remote; its Almanac stack (`8e247a3`) is a local commit, which is where
the deploy runs from. The README and `docs/` follow the readme-docs standard
since the evening of 2026-10-16. Nothing is deployed.

_2026-10-23_. Brief 12 moved `Dialog`, `Popover`, `Menu` and the phone drawer
onto Base UI ([decisions.md](decisions.md)). It is two local commits on `main`,
not pushed; 618 tests pass (the five removed tested deleted code).

_2026-10-27_. Brief 14 added Web Push: a push-only service worker, stored
subscriptions, and the account menu's Notifications dialog with a test
notification. Local commits, not pushed, 694 tests. A real push to a browser
or a phone has not been tried. Production push needs the `VAPID_*` values
passed by `../vps-deploy`'s Almanac stack, which doesn't pass them yet.
Brief 15 gave each event one reminder, stored and shown in the form and the
details. Brief 16 sends them: a tick a minute in the API process, each
reminder once, nothing more than 15 minutes late. 745 tests. A real Web Push
reached FCM from the built server on this machine; no phone has shown one yet.

## Next (owner)

1. Register Almanac in production Ward and write
   `../vps-deploy/secrets/almanac.env` with `WARD_OIDC_CLIENT_KEY` (the only
   key), then deploy, following [docs/owner-setup.md](../../docs/owner-setup.md).
2. Create your account with the seed inside the container. Sign in locally
   first, then link Ward from the account menu, or Ward creates a second,
   empty user.
3. Grant your Ward account (and anyone else who should have a calendar) the
   `almanac` app in Ward's console.
4. Not tried here: the "Sign in with Ward" round trip, locally (needs the
   local Ward seed with Docker Desktop's WSL integration on) or in
   production; adding it to a phone's home screen.
5. Notifications (brief 14): add the three `VAPID_*` values to
   `../vps-deploy/stacks/almanac.ts` (as `../vps-deploy/stacks/satchel.ts`
   has them), make a pair and put it in `../vps-deploy/secrets/almanac.env`
   with a real `VAPID_SUBJECT`, then deploy both halves, following
   [docs/owner-setup.md](../../docs/owner-setup.md) step 8. Then turn
   Notifications on in a desktop browser and on the iPhone's Home Screen app,
   and press "Send a test". Then give a real event two minutes out the
   reminder "At the start" and check it shows on time (brief 16's last
   acceptance line).

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

## Briefs

| # | Brief | State |
|---|---|---|
| 01 | [Workspace scaffold](../briefs/done/01-workspace-scaffold.md) | done |
| 02 | [Accounts and sign-in](../briefs/done/02-accounts-and-sign-in.md) | done |
| 03 | [Calendars, events and settings API](../briefs/done/03-calendars-and-events-api.md) | done |
| 04 | [Repeating events](../briefs/done/04-repeating-events.md) | done |
| 05 | [App shell, routes, dates, tokens](../briefs/done/05-app-shell.md) | done |
| 06 | [Day, week and month views](../briefs/done/06-day-week-month-views.md) | done |
| 07 | [Creating and editing events](../briefs/done/07-creating-and-editing-events.md) | done |
| 08 | [Year view](../briefs/done/08-year-view.md) | done |
| 09 | [Calendars and time zone](../briefs/done/09-calendars-and-time-zone.md) | done |
| 10 | [Search](../briefs/done/10-search.md) | done |
| 11 | [Deploy and docs](../briefs/done/11-deploy-and-docs.md) | done |
| 12 | [Base UI under Dialog, Popover, Menu and the drawer](../briefs/done/12-base-ui-primitives.md) | done 2026-10-23, local commits, not pushed |
| 13 | [Fix the stale app lists in sibling repos](../briefs/todo/13-sibling-repo-listings.md) | todo (filed 2026-10-23) |
| 14 | [Phone notifications 1: the worker and the push subscription](../briefs/done/14-push-subscription-and-worker.md) | done 2026-10-27, local commits, not pushed; no live push tried |
| 15 | [Phone notifications 2: a reminder on each event](../briefs/done/15-a-reminder-on-each-event.md) | done 2026-10-27, local commits, not pushed |
| 16 | [Phone notifications 3: send due reminders](../briefs/done/16-send-due-reminders.md) | done 2026-10-27, local commits, not pushed; no phone tried |

## Todos

- None open. Phone notifications became briefs 14–16 and the sibling-repo counts
  brief 13 (2026-10-23).
