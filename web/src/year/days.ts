import { compareOccurrences, type Calendar, type Occurrence } from "@almanac/shared";
import { Temporal, dateKey, formatTime, zonedOf, type DateSpan } from "../dates";

/**
 * Which days an occurrence is on, for the year view's dots and its day
 * list. Pure (no React, no fetching), so Node can test it.
 *
 * Timed occurrences come off the wire as UTC instants: they are put on the
 * display time zone's clock before deciding which days they cover (10 pm UTC
 * is already tomorrow in Bucharest). All-day ones are `YYYY-MM-DD` with an
 * exclusive end and need no zone.
 */

/** The occurrences on a calendar that is known and shown: the month view's rule, so the dots match it. */
export function shownOccurrences(occurrences: readonly Occurrence[], calendars: readonly Calendar[]): Occurrence[] {
  const shown = new Set(calendars.filter((calendar) => calendar.visible).map((calendar) => calendar.id));
  return occurrences.filter((occurrence) => shown.has(occurrence.calendarId));
}

/** The first and the last day (both included) an occurrence is on, in `timeZone`. Never empty: a one-day event is its own first and last. */
export function coveredSpan(
  occurrence: Pick<Occurrence, "allDay" | "start" | "end">,
  timeZone: string,
): { first: Temporal.PlainDate; last: Temporal.PlainDate } {
  if (occurrence.allDay) {
    const first = Temporal.PlainDate.from(occurrence.start);
    const last = Temporal.PlainDate.from(occurrence.end).subtract({ days: 1 });
    return { first, last: Temporal.PlainDate.compare(last, first) < 0 ? first : last };
  }
  const start = zonedOf(occurrence.start, timeZone);
  const end = zonedOf(occurrence.end, timeZone);
  const first = start.toPlainDate();
  // The end is exclusive: an event that ends at midnight doesn't reach the day that starts there.
  const last = end.subtract({ nanoseconds: 1 }).toPlainDate();
  return { first, last: Temporal.PlainDate.compare(last, first) < 0 ? first : last };
}

/** Whether `date` is one of the days of `occurrence`. */
export function isOnDay(occurrence: Pick<Occurrence, "allDay" | "start" | "end">, date: Temporal.PlainDate, timeZone: string): boolean {
  const { first, last } = coveredSpan(occurrence, timeZone);
  return Temporal.PlainDate.compare(first, date) <= 0 && Temporal.PlainDate.compare(date, last) <= 0;
}

/**
 * The days (`YYYY-MM-DD`) with at least one shown occurrence, within `span`
 * (an event that runs on past it marks no further than its end).
 */
export function markedDays(
  occurrences: readonly Occurrence[],
  calendars: readonly Calendar[],
  timeZone: string,
  span: DateSpan,
): Set<string> {
  const marked = new Set<string>();
  const lastShown = span.end.subtract({ days: 1 });
  for (const occurrence of shownOccurrences(occurrences, calendars)) {
    const { first, last } = coveredSpan(occurrence, timeZone);
    let day = Temporal.PlainDate.compare(first, span.start) < 0 ? span.start : first;
    const stop = Temporal.PlainDate.compare(last, lastShown) > 0 ? lastShown : last;
    for (; Temporal.PlainDate.compare(day, stop) <= 0; day = day.add({ days: 1 })) marked.add(dateKey(day));
  }
  return marked;
}

/** The shown occurrences on `date`, in the day view's order: all-day ones first, then by start time. */
export function occurrencesOn(
  date: Temporal.PlainDate,
  occurrences: readonly Occurrence[],
  calendars: readonly Calendar[],
  timeZone: string,
): Occurrence[] {
  return shownOccurrences(occurrences, calendars)
    .filter((occurrence) => isOnDay(occurrence, date, timeZone))
    .sort(compareOccurrences(timeZone));
}

/** "All day", or the start time on the display time zone's 24-hour clock ("10:00"). */
export function timeLabel(occurrence: Pick<Occurrence, "allDay" | "start">, timeZone: string): string {
  return occurrence.allDay ? "All day" : formatTime(zonedOf(occurrence.start, timeZone));
}
