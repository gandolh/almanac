import { isIanaZone } from "@almanac/shared";
import { Temporal } from "temporal-polyfill";
import type { EventRecord } from "../events/index.js";
import { escapeText, joinLines } from "./ics.js";
import { formatLocal, vtimezoneLines } from "./vtimezone.js";

/**
 * A user's events as one iCalendar file (RFC 5545), for the calendar feed.
 *
 * Every stored row is written as it is: a one-off as one `VEVENT`, a series
 * as one `VEVENT` with its `RRULE` and an `EXDATE` per deleted occurrence,
 * and each exception as a `VEVENT` of its own with the series' `UID` and a
 * `RECURRENCE-ID`. The calendar app expands the rules; nothing is expanded
 * here. There is never a `VALARM`: the reminder stays Web Push's.
 *
 * - A timed one-off or exception is in UTC (`20261016T070000Z`).
 * - A timed series is in its own zone (`DTSTART;TZID=Europe/Bucharest:…`),
 *   so the calendar app keeps it at 10:00 across a change of summer time,
 *   as Almanac does; its deleted occurrences and `RECURRENCE-ID`s take the
 *   same form, and the stored `UNTIL` is already UTC.
 * - An all-day event is dates (`VALUE=DATE`), its end exclusive, as stored.
 *
 * `DTSTAMP`, `CREATED` and `LAST-MODIFIED` come from the rows, so the same
 * events give the same bytes on every request (the feed's `ETag`).
 */

/** The `PRODID`: who wrote the file. */
const PRODUCT_ID = "-//Almanac//Calendar feed//EN";

/** How often a calendar app should look again, for the apps that read the hint (RFC 7986). */
const REFRESH_INTERVAL = "PT1H";

export interface FeedCalendarOptions {
  /** Every row the user has: one-offs, series and exceptions, in any order. */
  events: readonly EventRecord[];
  /** The user's display time zone: the calendar's `X-WR-TIMEZONE`, and a `VTIMEZONE` always present. */
  timeZone: string;
  /** Now: the year whose rules each `VTIMEZONE` is read from. */
  now: Date;
}

/** An instant or an ISO timestamp (`2026-10-16T07:00:00.123Z`) as `20261016T070000Z`. */
function utcValue(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 19).replaceAll("-", "").replaceAll(":", "")}Z`;
}

/** A date (`2026-10-16`) as `20261016`. */
function dateValue(date: string): string {
  return date.replaceAll("-", "");
}

/** An instant as the wall-clock time it is in `tzid`, without a zone: `20261016T100000`. */
function localValue(instant: string, tzid: string): string {
  return formatLocal(Temporal.Instant.from(instant).toZonedDateTimeISO(tzid).toPlainDateTime());
}

/**
 * A row's `UID`: its id and when it was made, so an id SQLite hands out
 * again after the newest row is deleted is still another event. Stable for
 * as long as the row lives.
 */
export function uidOf(event: Pick<EventRecord, "id" | "createdAt">): string {
  return `event-${event.id}-${utcValue(event.createdAt)}@almanac`;
}

/** The zone a series' times are written in: its own, or UTC for a value no runtime knows. */
function zoneOf(event: EventRecord): string {
  return isIanaZone(event.tzid) ? event.tzid : "UTC";
}

/** `DTSTART` and `DTEND` for a row: dates, a series' wall-clock times in its zone, or UTC. */
function timeLines(event: EventRecord): string[] {
  if (event.allDay) return [`DTSTART;VALUE=DATE:${dateValue(event.start)}`, `DTEND;VALUE=DATE:${dateValue(event.end)}`];
  if (event.rrule !== null) {
    const zone = zoneOf(event);
    return [
      `DTSTART;TZID=${zone}:${localValue(event.start, zone)}`,
      `DTEND;TZID=${zone}:${localValue(event.end, zone)}`,
    ];
  }
  return [`DTSTART:${utcValue(event.start)}`, `DTEND:${utcValue(event.end)}`];
}

/** An occurrence key of `series` (its `EXDATE` or an exception's `RECURRENCE-ID`) in the form of the series' `DTSTART`. */
function keyValue(series: EventRecord, key: string): { params: string; value: string } {
  if (series.allDay) return { params: ";VALUE=DATE", value: dateValue(key) };
  const zone = zoneOf(series);
  return { params: `;TZID=${zone}`, value: localValue(key, zone) };
}

/** The lines every `VEVENT` has: the stamps, then what the user typed (empty fields left out). */
function contentLines(event: EventRecord): string[] {
  const lines = [
    `DTSTAMP:${utcValue(event.updatedAt)}`,
    `CREATED:${utcValue(event.createdAt)}`,
    `LAST-MODIFIED:${utcValue(event.updatedAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.location !== "") lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.notes !== "") lines.push(`DESCRIPTION:${escapeText(event.notes)}`);
  return lines;
}

/** A one-off, or a series with its deleted occurrences. */
function eventLines(event: EventRecord): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${uidOf(event)}`, ...timeLines(event)];
  if (event.rrule !== null) {
    lines.push(`RRULE:${event.rrule.replace(/^RRULE:/, "")}`);
    for (const key of event.exdates) {
      const { params, value } = keyValue(event, key);
      lines.push(`EXDATE${params}:${value}`);
    }
  }
  lines.push(...contentLines(event), "END:VEVENT");
  return lines;
}

/** An exception: the series' `UID`, and the occurrence it replaces as a `RECURRENCE-ID`. */
function exceptionLines(exception: EventRecord, series: EventRecord, originalStart: string): string[] {
  const { params, value } = keyValue(series, originalStart);
  return [
    "BEGIN:VEVENT",
    `UID:${uidOf(series)}`,
    `RECURRENCE-ID${params}:${value}`,
    ...timeLines(exception),
    ...contentLines(exception),
    "END:VEVENT",
  ];
}

/** The whole file, CRLF line ends, every line folded at 75 octets. */
export function feedCalendar({ events, timeZone, now }: FeedCalendarOptions): string {
  const byId = new Map(events.map((event) => [event.id, event]));
  const exceptions = new Map<number, EventRecord[]>();
  const rows: EventRecord[] = [];
  for (const event of [...events].sort((a, b) => a.id - b.id)) {
    const series = event.seriesId === null ? undefined : byId.get(event.seriesId);
    if (series !== undefined && series.rrule !== null && event.originalStart !== null) {
      exceptions.set(series.id, [...(exceptions.get(series.id) ?? []), event]);
    } else {
      // A one-off, a series, or an exception whose series isn't in the list, which can only stand alone.
      rows.push(event);
    }
  }

  const zones = new Set([isIanaZone(timeZone) ? timeZone : "UTC"]);
  for (const event of rows) if (event.rrule !== null && !event.allDay) zones.add(zoneOf(event));
  const year = now.getUTCFullYear();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Almanac",
    `X-WR-TIMEZONE:${[...zones][0] ?? "UTC"}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`,
    `X-PUBLISHED-TTL:${REFRESH_INTERVAL}`,
  ];
  for (const zone of [...zones].sort()) lines.push(...vtimezoneLines(zone, year));
  for (const event of rows) {
    lines.push(...eventLines(event));
    const own = (exceptions.get(event.id) ?? []).sort((a, b) =>
      (a.originalStart ?? "") < (b.originalStart ?? "") ? -1 : 1,
    );
    for (const exception of own) lines.push(...exceptionLines(exception, event, exception.originalStart ?? ""));
  }
  lines.push("END:VCALENDAR");
  return joinLines(lines);
}
