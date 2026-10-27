---
summary: What Almanac v1 does, screen by screen, as settled with the owner on 2026-10-16. The Google-style layout (top bar, left column with mini-month and calendars), the four views with month as default, mouse interactions and keyboard shortcuts, event fields, search, the account menu, date and time format, and what is deliberately left out. Read before writing or promoting any brief.
updated: 2026-10-27
---

# Features

The model is Google Calendar played straight, light only
([decisions.md](decisions.md)). Words follow [glossary.md](glossary.md).

## Layout

- Top bar: menu button (collapses the left column), the app name, Today, ‹ ›,
  the current range ("October 2026"), search, the view switcher, the account
  button.
- Left column: a Create button, a mini-month for jumping to a date, and the
  user's calendars, each with its colour and a show/hide checkbox.
- On a phone the left column becomes a drawer and the views fill the screen.

## Views

- Day, week, month and year. Month opens by default.
- Day, week and month are FullCalendar. Year is our own: 12 mini-months on one
  screen, a dot on days that have events, clicking a day shows its events with
  a link to that day.
- Weeks start on Monday. Times use a 24-hour clock, dates read "16 Oct 2026".
  The interface is English.
- A line marks the current time in day and week.

## Interactions

- Click or drag across empty time opens quick create. "More options" opens the
  event form.
- Click an event: a details popover with Edit and Delete.
- Day and week: drag an event to move it, drag its bottom edge to resize.
  Month: drag an event to another day.
- Moving, resizing or deleting an occurrence of a series asks for the edit
  scope.
- Shortcuts: `c` create, `t` today, `d` `w` `m` `y` switch views, ← → back and
  forward, `/` search.

## Events

- Title, start and end, all-day, calendar, location, notes.
- Links in location and notes are clickable.
- Repeats: does not repeat, daily, every weekday, weekly on chosen days,
  monthly, yearly; ends never, on a date, or after N times
  ([recurrence.md](recurrence.md)).

## Search

A box in the top bar finds the user's events by title, location or notes and
lists the matches by date. Clicking one opens that day.

## Calendars

Create, rename, recolour and delete calendars from the left column. Deleting a
calendar deletes its events after a confirm, as in Google. A new user
starts with one calendar.

## Account menu

Change password, link or unlink Sign in with Ward, display time zone (starts
at Europe/Bucharest), sign out. No Settings page. After v1, brief 14 added
Notifications (turn push on in this browser, send a test).

## Left out of v1

Import of any kind, reminders (the first follow-up, built after v1 by briefs
14-16 on 2026-10-27), sharing, guests and
invitations, attachments, per-event time zones, a custom repeat editor, dark
mode, offline use.
