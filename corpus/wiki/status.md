---
summary: Snapshot as of 2026-10-16. v1 is built - all 11 briefs done and committed on main, then a review round (three code reviewers and two browser walkthroughs) with two fix rounds, 623 tests. Not pushed (remote is gandolh/almanac on GitHub) and not deployed. What waits on the owner, one line per brief, accepted known issues, and the todos by tier.
updated: 2026-10-16
---

# Status

_2026-10-16_. v1 is built. The owner settled the design in a grill
([decisions.md](decisions.md), [features.md](features.md)); the 11 briefs
were built the same day with `plan-split-dispatch`, one commit per brief on
`main`, then reviewed by three code finders (web wiring, server
correctness, conventions) and a browser walkthrough of every flow, and the
findings were fixed in three lanes, re-checked in the browser, and the last
three leftovers fixed after a pause. 623 tests pass; typecheck, lint and
build are clean. The remote is `https://github.com/gandolh/almanac.git`
(set 2026-10-16); nothing is pushed. Nothing is deployed.

## Next (owner)

1. Push `main` here (`git push -u origin main`), and the unpushed commits in
   `../vps-deploy` (`8e247a3`, the Almanac stack) and `../wzd_auth`
   (`22e1fd2`, the local seed entry).
2. Register Almanac in production Ward and write
   `../vps-deploy/secrets/almanac.env` with `WARD_OIDC_CLIENT_KEY` (the only
   key), then deploy, following [docs/owner-setup.md](../../docs/owner-setup.md).
3. Create your account with the seed inside the container. Sign in locally
   first, then link Ward from the account menu, or Ward creates a second,
   empty user.
4. Grant your Ward account (and anyone else who should have a calendar) the
   `almanac` app in Ward's console.
5. Not tried here: the "Sign in with Ward" round trip, locally (needs the
   local Ward seed with Docker Desktop's WSL integration on) or in
   production; adding it to a phone's home screen.

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
  watchers; the polling workaround is in the owner-setup doc.
- The first quick-create event in the very first browser walk seemed to
  vanish once; it never reproduced in later runs.

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

## Todos

- v1.x: [phone notifications](../todos/phone-notifications.md).
- later: [stale counts in sibling repos](../todos/sibling-repo-listings.md).
