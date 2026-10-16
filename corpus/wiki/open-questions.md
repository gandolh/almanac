---
summary: Genuinely unresolved questions. As of 2026-10-16 the owner's product questions are all answered; two technical checks remain for the brief writer (FullCalendar v7 named time zones, Temporal in the browser). Delete each the moment it is answered.
updated: 2026-10-16
---

# Open questions

Product questions: none. The owner's grill on 2026-10-16 settled them
([decisions.md](decisions.md)).

Technical checks to do while writing the briefs:

- **Named time zones in FullCalendar v7.** In v6, showing a named zone such as
  Europe/Bucharest needed a Luxon or moment-timezone plugin. Check whether v7's
  Temporal base handles it alone. The display time zone decision depends on it.
- **Temporal in the browser.** FullCalendar v7 needs a `temporal-polyfill`
  peer. Check its size and whether the server and web can share one Temporal
  setup.
