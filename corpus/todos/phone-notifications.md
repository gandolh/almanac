---
title: Phone notifications before events
created: 2026-10-16
status: open
tags: [v1.x]
---

# Phone notifications before events

Each event gets "remind me N minutes before", and the phone shows a
notification at that time. The owner turned this down for v1 to keep it small
and named it the first follow-up.

## Context

Web Push, reusing Satchel's push code (`../satchel`). It needs the app added to
the home screen (on iPhone, push works only for installed web apps), push
keys in `.env`, a service worker, and a timer on the server that sends due
reminders, including for occurrences of a series. See
[decisions.md](../wiki/decisions.md), "No reminders in v1".
