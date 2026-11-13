---
title: Almanac's events on the phone's calendar
created: 2026-11-13
status: promoted
tags: [later, phone]
---

# Almanac's events on the phone's calendar

**Promoted** on 2026-11-13 to [brief 06](../briefs/done/06-almanac-events-on-the-phone-calendar.md): a read-only feed of all the user's calendars, no alarms, Web Push the one reminder (the owner's answer of 2026-11-13).

The owner asked for this on 2026-11-13, grilling the self-hosted tools
research in `vps-deploy` (its `self-hosted-tools-adopt-or-borrow.md`, the
Nextcloud section). Nextcloud works with every phone because it speaks
CalDAV. Almanac could show its events in the phone's own calendar app the
same way, without the owner opening Almanac.

This is the other direction from [No import; events are typed in](../wiki/decisions.md)
(2026-10-16), which turned down bringing `.ics` files and subscribed feeds
*into* Almanac. Sending Almanac's events *out* doesn't reopen it.

The same day the owner turned down syncing the phone's contacts and
calendar with the mail server, so Almanac stays the one calendar.

## Two ways, to grill at promotion

- **A read-only feed** (default). Each user gets a private `.ics` URL that
  holds a secret token, revocable from Settings. On Android, ICSx5
  subscribes to it and the phone's calendar shows the events; edits still
  happen in Almanac. Small: a route that writes the user's events as
  iCalendar (ical-generator, MIT, was the 2026-10-16 survey's pick for
  writing feeds, see [research.md](../wiki/research.md)).
- **CalDAV.** Two-way: an event edited on the phone goes back to Almanac.
  Almanac would have to be a CalDAV server, far bigger work.

## Questions for the grill

- Feed or CalDAV.
- Reminders: the phone's calendar would alert as well as Almanac's Web
  Push. Strip alarms from the feed (ICSx5 can) or keep one of the two.
- Which calendars go in the feed: all of the user's, or the ones ticked.
- How often the phone refreshes (ICSx5's interval) and whether that delay
  is acceptable.
