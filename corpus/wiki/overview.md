---
summary: What Almanac is in a paragraph. The owner's personal calendar, a Google Calendar look-alike with day, week, month and year views where they type in every meeting and event from everywhere they have a schedule. Private per user, no sharing, no import, light only, on the estate's Fastify + React + SQLite stack.
updated: 2026-10-16
---

# Overview

Almanac is the owner's personal calendar. They type in every meeting and event
from all the places they have schedules, and see them in day, week, month or
year views, month by default. It works the way Google Calendar does: the same
layout, click or drag to create, drag to move and resize, the same keyboard
shortcuts. Events sit in named, coloured calendars that can be hidden one at a
time.

It is private. Each user sees only their own calendars, nothing is shared, and
there is no sign-up: the owner is seeded and anyone else gets in through a Ward
grant. Sign-in is the app's own login or "Sign in with Ward".

It deliberately leaves out import, reminders (the first follow-up), guests,
attachments, dark mode and offline use ([decisions.md](decisions.md)).

It is a sibling of Shelfmark (`../shelfmark`) and Satchel (`../satchel`): the
same Fastify + SQLite + React stack, the same vendored Ward auth, the same VPS
deploy ([architecture.md](architecture.md)).
