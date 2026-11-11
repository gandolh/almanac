import {
  SEARCH_LIMIT,
  compareOccurrences,
  describeRepeat,
  occurrenceDate,
  type Calendar,
  type Occurrence,
} from "@almanac/shared";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { ApiError } from "../api";
import { displayTitle } from "../calendar/events";
import { Button } from "../components/Button";
import { Link } from "../components/Link";
import { calendarColor, useCalendars } from "../data/calendars";
import { onOccurrencesChanged } from "../data/occurrences";
import { useSettings } from "../data/settings";
import { toApiError } from "../data/store";
import { RANGE_DASH, Temporal, formatDate, formatTime, weekdayShort, zonedOf } from "../dates";
import { viewRoute } from "../router";
import { normalizeQuery, searchEvents } from "./search-api";

export interface SearchResultsProps {
  /** `?q=` from the address, as typed; may be empty. */
  query: string;
}

/**
 * The search results, Google's list: matches grouped by the date they start
 * on, the date at left, then each event's calendar colour, its time, its
 * title and location, and under the title how it repeats. A click opens the
 * day. Searching again after every change to the events (`onOccurrencesChanged`),
 * keeping the list on screen meanwhile.
 */
export function SearchResults({ query }: SearchResultsProps) {
  const { timeZone } = useSettings();
  const { calendars } = useCalendars();
  const q = normalizeQuery(query);
  const [answer, setAnswer] = useState<Answer | null>(null);
  // Bumped by a change to the events and by Try again: search once more.
  const [round, setRound] = useState(0);

  useEffect(() => onOccurrencesChanged(() => setRound((n) => n + 1)), []);

  useEffect(() => {
    if (q === "") return;
    const controller = new AbortController();
    searchEvents(q, { signal: controller.signal }).then(
      (results) => setAnswer({ query: q, outcome: { kind: "results", results } }),
      (error: unknown) => {
        // A search that was replaced (or this page left): nobody is waiting for it.
        if (controller.signal.aborted) return;
        setAnswer({
          query: q,
          outcome: { kind: "error", error: toApiError(error, "The search couldn't be completed.") },
        });
      },
    );
    return () => controller.abort();
  }, [q, round]);

  if (q === "") return <ResultsMessage>Search your events by title, location or notes.</ResultsMessage>;

  // An answer to an earlier query doesn't count: the new one is still on its way.
  const outcome = answer?.query === q ? answer.outcome : null;
  if (outcome === null) return <ResultsMessage role="status">Searching…</ResultsMessage>;
  if (outcome.kind === "error") {
    return (
      <ResultsMessage role="alert">
        <span>{outcome.error.message}</span>
        {/* A query the server refuses won't do better the second time. */}
        {outcome.error.code !== "validation" && (
          <Button
            onClick={() => {
              setAnswer(null);
              setRound((n) => n + 1);
            }}
          >
            Try again
          </Button>
        )}
      </ResultsMessage>
    );
  }
  return <ResultsView query={q} results={outcome.results} timeZone={timeZone} calendars={calendars} />;
}

/** What a search has come to: the matches, or why not. The query it answers is kept to tell a stale answer from a current one. */
interface Answer {
  query: string;
  outcome: { kind: "results"; results: readonly Occurrence[] } | { kind: "error"; error: ApiError };
}

function ResultsMessage({ role, children }: { role?: "status" | "alert"; children: ReactNode }) {
  return (
    <section
      className="mx-auto flex w-full max-w-search-content flex-1 items-start justify-center px-6 pt-[72px] pb-8 max-md:px-gutter-phone max-md:pt-12 max-md:pb-6"
      aria-label="Search results"
    >
      <div
        className="flex flex-col items-center gap-4 text-center text-body leading-body wrap-anywhere text-muted"
        role={role}
      >
        {children}
      </div>
    </section>
  );
}

// --- The list ---------------------------------------------------------------------------------

export interface ResultsViewProps {
  /** The search these answer, as it was sent. */
  query: string;
  results: readonly Occurrence[];
  /** The display time zone: the dates and times are read in it. */
  timeZone: string;
  /** To colour each result; one whose calendar isn't in the list yet gets a neutral dot. */
  calendars: readonly Calendar[];
}

/** The answer to a search, without fetching it (for tests): "No results for …", or the days. */
export function ResultsView({ query, results, timeZone, calendars }: ResultsViewProps) {
  if (results.length === 0) {
    return <ResultsMessage role="status">{`No results for "${query}".`}</ResultsMessage>;
  }
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  return (
    <section
      className="mx-auto w-full max-w-search-content flex-none px-6 pt-2 pb-8 max-md:px-gutter-phone max-md:pt-0 max-md:pb-6"
      aria-label="Search results"
    >
      <ol>
        {groupResults(results, timeZone).map((day) => (
          <li
            key={day.key}
            className="grid grid-cols-[var(--search-date-column)_minmax(0,1fr)] border-t border-divider py-2 first:border-t-0 max-md:grid-cols-[minmax(0,1fr)] max-md:pt-3 max-md:pb-1"
          >
            <h2 className="pt-3 pl-3 text-small font-medium tracking-[0.04em] text-ink uppercase max-md:pt-0 max-md:pb-1 max-md:pl-0">
              <time dateTime={day.key}>{dateLabel(day.date)}</time>
            </h2>
            <ul>
              {day.items.map((occurrence) => (
                <li key={occurrence.id}>
                  <ResultRow
                    occurrence={occurrence}
                    day={day.date}
                    calendar={byId.get(occurrence.calendarId)}
                    timeZone={timeZone}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {results.length >= SEARCH_LIMIT && (
        <p className="mt-4 px-3 text-small text-muted">
          Showing the first {SEARCH_LIMIT} results. Try more specific words.
        </p>
      )}
    </section>
  );
}

interface ResultRowProps {
  occurrence: Occurrence;
  day: Temporal.PlainDate;
  calendar: Calendar | undefined;
  timeZone: string;
}

function ResultRow({ occurrence, day, calendar, timeZone }: ResultRowProps) {
  const repeat = occurrence.repeat
    ? describeRepeat(occurrence.repeat, occurrence.originalStart ?? occurrence.start, timeZone)
    : null;
  const dot = calendar ? ({ "--calendar-color": calendarColor(calendar) } as CSSProperties) : undefined;
  return (
    <Link
      to={viewRoute("day", day)}
      className="grid grid-cols-[var(--size-search-dot)_var(--search-time-column)_minmax(0,1fr)] items-start gap-x-3 rounded-control px-3 py-2 text-meta leading-tight text-ink no-underline transition-[background-color] duration-(--duration-fast) ease-out hover:bg-hover hover:text-ink focus-visible:-outline-offset-2 active:bg-press max-md:min-h-(--size-touch) max-md:grid-cols-[var(--size-search-dot)_minmax(0,1fr)] max-md:gap-y-0.5 max-md:rounded-none max-md:px-0"
    >
      <span
        className="mt-1 size-search-dot rounded-pill bg-[var(--calendar-color,var(--color-muted))] [grid-area:1/1] max-md:mt-[3px] max-md:[grid-area:1/1/3/2]"
        style={dot}
        aria-hidden="true"
      />
      <span className="whitespace-nowrap text-ink-2 tabular-nums [grid-area:1/2]">
        {timeText(occurrence, timeZone)}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 [grid-area:1/3] max-md:[grid-area:2/2]">
        <span className="flex flex-wrap gap-x-3">
          <span className="font-medium wrap-anywhere">{displayTitle(occurrence.title)}</span>
          {occurrence.location !== "" && <span className="wrap-anywhere text-muted">{occurrence.location}</span>}
        </span>
        {repeat !== null && <span className="text-small wrap-anywhere text-muted">{repeat}</span>}
      </span>
    </Link>
  );
}

// --- Grouping and wording (pure) -----------------------------------------------------------------

/** The matches that start on one date. */
export interface SearchDay {
  /** `2026-10-16`. */
  key: string;
  date: Temporal.PlainDate;
  /** All-day first, then by start time. */
  items: Occurrence[];
}

/**
 * The results by the date each starts on in `timeZone`, the dates in order.
 * Within a date all-day events come first, then the rest by start time
 * (`compareOccurrences`, as a day view lists them).
 */
export function groupResults(results: readonly Occurrence[], timeZone: string): SearchDay[] {
  const days: SearchDay[] = [];
  for (const occurrence of [...results].sort(compareOccurrences(timeZone))) {
    const key = occurrenceDate(occurrence, timeZone);
    const last = days.at(-1);
    if (last?.key === key) last.items.push(occurrence);
    else days.push({ key, date: Temporal.PlainDate.from(key), items: [occurrence] });
  }
  return days;
}

/** A group's date: "16 Oct 2026, Fri". The stylesheet capitals it, as Google does ("16 OCT 2026, FRI"). */
export function dateLabel(date: Temporal.PlainDate): string {
  return `${formatDate(date)}, ${weekdayShort(date.dayOfWeek)}`;
}

/** "All day", or "10:00 – 11:00" read in `timeZone`. */
export function timeText(occurrence: Pick<Occurrence, "allDay" | "start" | "end">, timeZone: string): string {
  if (occurrence.allDay) return "All day";
  return `${formatTime(zonedOf(occurrence.start, timeZone))}${RANGE_DASH}${formatTime(zonedOf(occurrence.end, timeZone))}`;
}
