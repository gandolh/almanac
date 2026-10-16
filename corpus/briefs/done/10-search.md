# Task 10: Search

## Context

Replace the `SearchBox` and `SearchResults` stubs: a search field in the top
bar that finds the user's events by title, location or notes and lists them
by date ([features.md](../../wiki/features.md), "Search"). The server side
exists: `GET /api/search?q` (brief 03), with series contributing their next
occurrence (brief 04) and diacritics folded server side.

Depends on: 05 (stubs, router with the `search` route and `?q=`,
`registerCommand`, `dates.ts`, `useCalendars`), 06 (`onOccurrencesChanged`).

## Files you OWN

```
web/src/search/SearchBox.tsx  web/src/search/SearchResults.tsx   (replace the stubs)
web/src/search/search-api.ts  web/src/search/search.css  web/src/search/*.test.ts
```

## Files you must NOT touch

Everything outside `web/src/search/`.

## What to do

1. **SearchBox**: a magnifier button in the top bar that expands into a
   field (on a phone it covers the top bar while open). Enter navigates to
   `/search?q=<query>`; Esc or the back arrow closes it and returns to the
   last calendar view. Register the "focusSearch" command (the `/` key).
   Opening `/search?q=` directly fills the field.
2. **SearchResults**: fetches `GET /api/search?q`, then lists the results
   grouped by date in Google's style: the date at left ("16 OCT 2026, FRI"),
   then each event's colour dot, "All day" or "10:00 – 11:00", title and
   location. A repeating event shows its repeat text under the title. Clicking
   a result opens the day view on its date. States: searching, "No results
   for "x"", and an error with retry. Refetch on `onOccurrencesChanged`.
3. Tests: grouping and ordering by date, the time text, the empty state
   markup.

## Acceptance

- typecheck, lint, `npx vitest run web` and build pass.
- In the browser `/`, "sedinta", Enter lists an event titled "Ședință"; a
  click opens its day.

## Outcome

_2026-10-16_. Built with 17 tests on grouping, labels and markup. Results
are real links to the day; requests abort when the query changes; a note
shows when 50 come back. Results from hidden calendars are listed (the brief
asked for no filter). Open: on a phone the field covers the bar but the
buttons under it stay in tab order (TopBar would need `inert`); the
768-1200 px field widths need a browser look.
