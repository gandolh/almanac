import type { Occurrence } from "@almanac/shared";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { isApiError } from "../api";
import { Temporal, formatTime, instantRange, type DateSpan } from "../dates";
import { fetchOccurrences, onOccurrencesChanged } from "./occurrences";

/** Where a span's fetch stands: the first answer is awaited, or came, or failed (the last good answer stays on screen). */
export type SpanStatus = "loading" | "ready" | "error";

export interface OccurrenceSpan {
  occurrences: readonly Occurrence[];
  status: SpanStatus;
  /** Ask again after a failure. */
  retry: () => void;
}

/**
 * The occurrences overlapping `span` in `timeZone` (`GET /api/occurrences`),
 * for the day card and the phone's week agenda. Fetched again when the span
 * or the zone changes and after a write anywhere; the last answer stays
 * while the next is fetched, so a list never blinks empty on every edit.
 * A failure is a status, for the caller to word in place.
 */
export function useOccurrenceSpan(span: DateSpan, timeZone: string): OccurrenceSpan {
  const [occurrences, setOccurrences] = useState<readonly Occurrence[]>([]);
  const [status, setStatus] = useState<SpanStatus>("loading");
  const [version, setVersion] = useState(0);
  const start = span.start.toString();
  const end = span.end.toString();

  // A write anywhere: fetch again.
  useEffect(() => onOccurrencesChanged(() => setVersion((current) => current + 1)), []);

  useEffect(() => {
    const controller = new AbortController();
    const { from, to } = instantRange(
      { start: Temporal.PlainDate.from(start), end: Temporal.PlainDate.from(end) },
      timeZone,
    );
    fetchOccurrences(from, to, { signal: controller.signal }).then(
      (found) => {
        if (controller.signal.aborted) return;
        setOccurrences(found);
        setStatus("ready");
      },
      (error: unknown) => {
        // Superseded by a newer request, or signed out (the login page takes over).
        if (controller.signal.aborted || isApiError(error, "signed_out")) return;
        setStatus("error");
      },
    );
    return () => controller.abort();
  }, [start, end, timeZone, version]);

  const retry = useCallback(() => {
    setStatus("loading");
    setVersion((current) => current + 1);
  }, []);
  return { occurrences, status, retry };
}

/** How often the wall clock is looked at; the minute a "now" mark shows moves on within this. */
const CLOCK_MS = 15_000;

function subscribeMinute(onChange: () => void): () => void {
  const timer = setInterval(onChange, CLOCK_MS);
  return () => clearInterval(timer);
}

/** The display time zone's wall clock as "10:30"; re-renders when the minute changes. */
export function useWallClock(timeZone: string): string {
  const read = useCallback(() => formatTime(Temporal.Now.instant().toZonedDateTimeISO(timeZone)), [timeZone]);
  return useSyncExternalStore(subscribeMinute, read, read);
}
