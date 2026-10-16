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
import "./search.css";

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
        setAnswer({ query: q, outcome: { kind: "error", error: toApiError(error, "The search couldn't be completed.") } });
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
    <section className="search-results search-results--message" aria-label="Search results">
      <div className="search-message" role={role}>
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
    return (
      <ResultsMessage role="status">{`No results for "${query}"`}</ResultsMessage>
    );
  }
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  return (
    <section className="search-results" aria-label="Search results">
      <ol className="search-days">
        {groupResults(results, timeZone).map((day) => (
          <li key={day.key} className="search-day">
            <h2 className="search-day__date">
              <time dateTime={day.key}>{dateLabel(day.date)}</time>
            </h2>
            <ul className="search-day__events">
              {day.items.map((occurrence) => (
                <li key={occurrence.id}>
                  <ResultRow occurrence={occurrence} day={day.date} calendar={byId.get(occurrence.calendarId)} timeZone={timeZone} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {results.length >= SEARCH_LIMIT && (
        <p className="search-results__limit">Showing the first {SEARCH_LIMIT} results. Search for more specific words to narrow them down.</p>
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
  const repeat = occurrence.repeat ? describeRepeat(occurrence.repeat, occurrence.originalStart ?? occurrence.start, timeZone) : null;
  const dot = calendar ? ({ "--calendar-color": calendarColor(calendar) } as CSSProperties) : undefined;
  return (
    <Link to={viewRoute("day", day)} className="search-event">
      <span className="search-event__dot" style={dot} aria-hidden="true" />
      <span className="search-event__time">{timeText(occurrence, timeZone)}</span>
      <span className="search-event__body">
        <span className="search-event__line">
          <span className="search-event__title">{displayTitle(occurrence.title)}</span>
          {occurrence.location !== "" && <span className="search-event__location">{occurrence.location}</span>}
        </span>
        {repeat !== null && <span className="search-event__repeat">{repeat}</span>}
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
