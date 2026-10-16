---
summary: Almanac's vocabulary, one word per concept with the synonyms it replaces. User, calendar, event, series, occurrence, exception, edit scope, view, display time zone, quick create and event form. Use these words in code, UI copy and briefs.
updated: 2026-10-16
---

# Glossary

## People

**User**:
A person who signs in, with a local password, a linked Ward account, or both.
A user owns calendars and sees nothing anyone else owns.
_Avoid_: account (for the person), member, profile

## Calendars and events

**Calendar**:
A named, coloured group of a user's events that can be shown or hidden as a
whole, like Work or Gym.
_Avoid_: category, label, tag, list, source

**Event**:
Something on a calendar with a title, a start and an end, or a date range if
it is all-day. One event belongs to one calendar.
_Avoid_: appointment, entry, item, meeting (a meeting is one kind of event)

**Series**:
An event with a repeat rule. The series is the stored row; what the views show
are its occurrences.
_Avoid_: recurring event, recurrence, repeating event (in code and docs; the UI
says "Repeats")

**Occurrence**:
One date and time a series happens on, as computed for a view.
_Avoid_: instance, recurrence, repetition

**Exception**:
An occurrence of a series that was moved, changed or deleted on its own.
_Avoid_: override, modified instance, detached event

**Edit scope**:
Which occurrences an edit to a series applies to: this event, this and
following events, or all events.
_Avoid_: mode, edit type

## Screens

**View**:
One of the four ways to look at time: day, week, month or year.
_Avoid_: mode, layout, page

**Display time zone**:
The user's setting that decides which clock every time is shown in.
_Avoid_: home zone, local time, user time zone

**Quick create**:
The small popover that opens when you click or drag on empty time, with a
title, the time and the calendar.
_Avoid_: quick add, popup, mini form

**Event form**:
The full editor for an event, opened from quick create's "More options" or
from Edit.
_Avoid_: edit page, event dialog, editor
