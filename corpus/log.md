# Log

## [2026-10-16] maintenance | Corpus bootstrapped

New repo at `~/projects/almanac`, local git on `main`, no remote (the owner
creates it later). Corpus rules, lint and routing copied from Shelfmark's and
adapted.

## [2026-10-16] decision | The owner's grill settled v1

One question at a time, answered by the owner. Name Almanac. Several users,
each with a private calendar, no sign-up. Named calendars. Common repeats with
three edit scopes. No import. No reminders in v1 (todo filed). Fields: title,
times, all-day, calendar, location, notes, plus search. Phone browser with a
home-screen icon. Display time zone is a per-user setting, Bucharest by
default (the owner first picked fixed Bucharest, then asked for a setting).
Monday, 24h. VPS deploy at port 8797. FullCalendar v7 with our own year view.
Google's keyboard shortcuts. Recorded in [decisions.md](wiki/decisions.md),
[features.md](wiki/features.md), [glossary.md](wiki/glossary.md); the library
survey in [research.md](wiki/research.md).

## [2026-10-16] todo | v1 briefs 01-11 filed

Eleven briefs in `briefs/todo/`, built in waves
`01 → 02 → 03 → 04 ‖ 05 → 06 → 07 ‖ 08 ‖ 09 ‖ 10 ‖ 11`. Brief 05 creates
stubs with fixed signatures so the web briefs after 06 run in parallel
without editing the shell. The two technical checks were answered first
(FullCalendar v7 takes named zones; the server uses `temporal-polyfill`) and
recorded in [architecture.md](wiki/architecture.md).
