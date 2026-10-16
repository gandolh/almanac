# Task 09: Managing calendars, and the time zone setting

## Context

Replace two stubs: `CalendarList` in the sidebar (Google's "My calendars")
and `TimeZoneDialog` in the account menu. Read
[features.md](../../wiki/features.md) ("Calendars", "Account menu") and
[decisions.md](../../wiki/decisions.md) ("Events belong to named calendars",
"One display time zone per user").

Depends on: 05 (`useCalendars`, `useSettings`, `Popover`, `Dialog`, `Toast`,
`components/Menu`), 03 (the last calendar can't be deleted: 409 `conflict`).

## Files you OWN

```
web/src/calendars/CalendarList.tsx   (replaces the stub, same export)
web/src/calendars/CalendarRow.tsx  web/src/calendars/ColorPicker.tsx
web/src/calendars/calendars.css  web/src/calendars/*.test.ts
web/src/account/TimeZoneDialog.tsx   (replaces the stub, same props)
web/src/account/time-zones.ts  web/src/account/time-zones.test.ts
```

## Files you must NOT touch

`web/src/data/*`, `web/src/layout/*`, `web/src/account/actions.ts`,
`ChangePassword.tsx`, everything outside the files above.

## What to do

1. **CalendarList**: a "My calendars" heading with a "+" button. Each row: a
   checkbox drawn in the calendar's colour (checked means visible; toggling
   saves `visible` at once), the name, and on hover or focus a "⋮" menu
   with Rename, the colour palette (`CALENDAR_COLORS` from shared, the
   current one ticked), and Delete. Rename edits in place (Enter saves, Esc
   cancels, 1-60 characters).
2. **Delete** asks in a `Dialog`: "Delete "Work"? Its events will be
   deleted too." Delete is disabled for the user's last calendar, with the
   reason in its title text; a 409 from the server shows the same message as
   a toast.
3. **"+"** opens a small form: name and colour (next unused colour as the
   default). The new calendar is visible.
4. **TimeZoneDialog**: the current zone at the top, a search field, and the
   list from `Intl.supportedValuesOf("timeZone")`, each shown with its
   current offset and city ("(GMT+03:00) Bucharest", grouped by region in
   the label as "Europe/Bucharest" secondary text). Searching matches city,
   region and offset, ignoring case and diacritics. Save calls
   `setTimeZone`; the views follow through the settings store. A line under
   the title says that times show in this zone wherever you are.
5. Tests: offset labels for a few zones in summer and winter, the search
   matcher, CalendarRow markup (checked and unchecked, last calendar's
   Delete disabled).

## Acceptance

- typecheck, lint, `npx vitest run web` and build pass.
- In the browser: add "Gym" in green, hide it and its events disappear from
  every view, rename it, recolour it and its events change colour, delete it
  and its events go. Switch the time zone to Europe/London and a 10:00
  Bucharest event shows at 08:00; switch back.

## Outcome

_2026-10-16_. Built with 44 tests. Departures: the colour palette opens as
a popover of swatches from a "Colour…" menu item rather than ten text items
in the ⋮ menu; the last calendar's disabled Delete shows "Only calendar" as
its detail (menu items take no title); a new `account/time-zone.css`. The
time zone list adds UTC, runs west to east, and matches city, region and
offsets ("+3", "gmt+3", "+5:30"), ignoring case and accents.
