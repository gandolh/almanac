---
title: Phone notifications before events
created: 2026-10-16
status: promoted
tags: [v1.x]
---

Promoted 2026-10-23 into three briefs, built in order:
[14](../briefs/done/14-push-subscription-and-worker.md) the worker and the push
subscription, [15](../briefs/done/15-a-reminder-on-each-event.md) a reminder on each
event, [16](../briefs/todo/16-send-due-reminders.md) sending due reminders.

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
