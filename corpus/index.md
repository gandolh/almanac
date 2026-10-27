# Almanac corpus index

Start here. Triage on the summary lines and open at most 2-3 pages.

- [CLAUDE.md](CLAUDE.md) - the rules for this corpus
- [routing.md](routing.md) - which skill runs the work, which layer answers which question
- [log.md](log.md) - chronological record of meaningful changes

## Wiki

<!-- BEGIN CATALOG -->

- [wiki/architecture.md](wiki/architecture.md) - How Almanac is put together, planned and then built on 2026-10-16. Shelfmark's three workspaces (shared, server, web), what each owns, the planned API routes, request paths behind Caddy, dev and production ports (API 8809, Vite 5177, VPS 8797), where data lives, and secrets.
- [wiki/data-model.md](wiki/data-model.md) - The SQLite schema as shipped by brief 03 on 2026-10-16, with brief 14's push subscriptions and brief 15's reminder column (2026-10-27). Calendars, events (one-offs, series and exceptions in one table, timed as UTC ms or all-day as dates, the tzid that anchors repeats, exdates as JSON, reminder_minutes) and user settings; push_subscriptions; the CHECKs and indexes; the wire format for instants, dates and occurrence keys; why there is no CHECK on colour or reminder; and how every row is scoped to a user.
- [wiki/decisions.md](wiki/decisions.md) - Locked calls for Almanac, each with date, rejected alternatives and reason. React + Fastify + SQLite on Shelfmark's layout; FullCalendar v7 for day, week and month with a year view of our own; several users, each with a private calendar and no sign-up; named calendars; Base UI under the dialogs, popovers and menus; common repeats with three edit scopes, expanded on the server; no import; no reminders in v1; one display time zone per user, Bucharest by default; phone browser without offline; deployed on the VPS; Google Calendar's layout, light only.
- [wiki/features.md](wiki/features.md) - What Almanac v1 does, screen by screen, as settled with the owner on 2026-10-16. The Google-style layout (top bar, left column with mini-month and calendars), the four views with month as default, mouse interactions and keyboard shortcuts, event fields, search, the account menu, date and time format, and what is deliberately left out. Read before writing or promoting any brief.
- [wiki/glossary.md](wiki/glossary.md) - Almanac's vocabulary, one word per concept with the synonyms it replaces. User, calendar, event, series, occurrence, exception, edit scope, reminder, view, display time zone, quick create and event form. Use these words in code, UI copy and briefs.
- [wiki/open-questions.md](wiki/open-questions.md) - Genuinely unresolved questions. As of 2026-10-16 there are none; the owner's grill settled the product and the two technical checks (FullCalendar v7 named time zones, Temporal on the server) were answered while writing the briefs. Add a question here the moment one opens, delete it the moment it is answered.
- [wiki/overview.md](wiki/overview.md) - What Almanac is in a paragraph. The owner's personal calendar, a Google Calendar look-alike with day, week, month and year views where they type in every meeting and event from everywhere they have a schedule. Private per user, no sharing, no import, light only, on the estate's Fastify + React + SQLite stack.
- [wiki/recurrence.md](wiki/recurrence.md) - How repeating events work in Almanac, as built by brief 04 on 2026-10-16. The repeat presets, storing a series as one row with an RRULE plus exception rows, expanding occurrences on the server with rrule-temporal in the zone each series was created in, and what each edit scope (this, this and following, all) does to the stored rows.
- [wiki/research.md](wiki/research.md) - The 2026-10-16 survey of open-source calendar apps and libraries behind Almanac's choices. Which React libraries give day, week, month and year views and drag and resize free (only FullCalendar v7), the repos worth borrowing from and what to take from each, the state of rrule.js versus rrule-temporal, and the ICS libraries in case import or export ever comes back.
- [wiki/status.md](wiki/status.md) - Snapshot as of 2026-10-16. v1 is built - all 11 briefs done and committed on main, then a review round (three code reviewers and two browser walkthroughs) with two fix rounds. Pushed to gandolh/almanac on GitHub, not deployed. Brief 12 (Base UI under the overlays) built 2026-10-23; briefs 14 (push worker and subscriptions) and 15 (a reminder on each event) built 2026-10-27, local, 714 tests. What waits on the owner, one line per brief, accepted known issues, and the todos by tier.

<!-- END CATALOG -->

## Work

- Brief states, the todo catalog by tier and the build order live in
  [wiki/status.md](wiki/status.md). Specs are in [briefs/](briefs/), captured
  ideas in [todos/](todos/).
