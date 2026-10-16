---
summary: The 2026-10-16 survey of open-source calendar apps and libraries behind Almanac's choices. Which React libraries give day, week, month and year views and drag and resize free (only FullCalendar v7), the repos worth borrowing from and what to take from each, the state of rrule.js versus rrule-temporal, and the ICS libraries in case import or export ever comes back.
updated: 2026-10-16
---

# Research

Checked on 2026-10-16 against GitHub, npm and vendor docs. Numbers drift;
recheck before quoting.

## React calendar libraries

| Library | Licence | Year view free | Drag/resize free | Repeats | State |
|---|---|---|---|---|---|
| FullCalendar v7 | MIT (paid: timeline, resources, print) | yes, `multiMonthYear` | yes | `@fullcalendar/rrule` on rrule.js | 7.1.3, v7 out 2026-06, 20.7k stars, native React, needs a `temporal-polyfill` peer |
| Schedule-X v4 | MIT core, premium €479/yr | yes | no, premium since v4 | own plugin | 4.9.1 |
| react-big-calendar | MIT | no | yes | none | 1.20.0, slow |
| @event-calendar/core | MIT | no | yes | none | Svelte 5, no React wrapper |
| DayPilot Lite | Apache-2.0 | no (Pro) | yes | unclear | 6.1.0 |
| TOAST UI Calendar | MIT | no | yes | none | archived, last release 2022 |
| ilamy-calendar | MIT | yes | yes | built in, with edit scopes | 3.2.1, one maintainer, React 19 + Tailwind 4 |

Chosen: FullCalendar v7 for day, week and month ([decisions.md](decisions.md)).
Its year view draws full month grids, so Almanac builds its own.

## Repos to borrow from

- **lramos33/big-calendar** (MIT, 1.1k stars). Layouts and polish: the
  current-time line, working-hours shading, multi-day bars, a year layout.
  No repeats, no backend.
- **kcsujeet/ilamy-calendar** (MIT). The repeat-edit dialog (this, following,
  all) and the excluded-dates plus exceptions model.
- **dotnetfactory/fluid-calendar** (MIT). FullCalendar wired to a database:
  schema and API shape. Its README calls it very buggy; borrow shape, not code.
- **nextcloud/calendar** is AGPL-3.0: ideas only, no code. It shows
  FullCalendar carrying a full Google-like app.

Not a match: Cal.com (now calcom/cal.diy, a booking tool), Radicale and Baikal
(CalDAV servers with no real UI), KDE Merkuro (desktop), unlicensed shadcn
scheduler repos (no licence, so no copying).

## Recurrence libraries

- **rrule.js** (BSD-3): last release 2.8.1 in 2023-11, about 184 open issues,
  returns "local" Dates and leans on Intl for time zones.
- **rrule-temporal** (MIT): 2.2.8 in 2026-10, built on Temporal, returns
  ZonedDateTime, handles excluded and extra dates, has `between()`. One
  maintainer; node-ical already moved to it. Chosen, on the server.

## ICS libraries

Not needed for v1 (no import, [decisions.md](decisions.md)). For later:
ical.js (MPL-2.0) parses and writes with time zones; node-ical (Apache-2.0)
parses and fetches URLs; ical-generator (MIT) writes feeds and files.
