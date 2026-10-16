import type { Calendar, EditScope, Occurrence } from "@almanac/shared";
import type { EventInput } from "@fullcalendar/react";
import { calendarColor } from "../data/calendars";
import type { EventPatchBody } from "../data/occurrences";
import { Temporal, wireInstant, type CalendarView } from "../dates";

/**
 * Between Almanac's occurrences and FullCalendar's events, both ways, with
 * no FullCalendar code: the views' tests run these in Node.
 *
 * - Going in, an occurrence keeps its wire times: FullCalendar shifts `…Z`
 *   instants into the display time zone itself and reads `YYYY-MM-DD` with
 *   an exclusive end as all-day dates.
 * - Coming back, FullCalendar's `Date`s are real instants; their wall-clock
 *   date is taken in the display time zone.
 */

/** Our views and FullCalendar's names for them. */
export const VIEW_TYPES: Readonly<Record<CalendarView, string>> = {
  day: "timeGridDay",
  week: "timeGridWeek",
  month: "dayGridMonth",
};

const HOUR_MS = 3_600_000;

/** The occurrence an event was made from (`extendedProps.occurrence`), or `null` for one we didn't make (a selection's mirror). */
export function occurrenceOf(event: { extendedProps: Record<string, unknown> }): Occurrence | null {
  const occurrence = event.extendedProps.occurrence;
  return typeof occurrence === "object" && occurrence !== null ? (occurrence as Occurrence) : null;
}

/** A title as the views show it: Google's "(No title)" for an empty one. */
export function displayTitle(title: string): string {
  return title.trim() === "" ? "(No title)" : title;
}

// --- Colour ------------------------------------------------------------------------------------

/** WCAG relative luminance of `#RRGGBB`. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The text colour on an event of `hex`: white, as Google writes on its
 * event colours, except on the palette's light yellow, where white can't be
 * read and the ink is used. A token, never a new colour.
 */
export function eventInk(hex: string): string {
  return luminance(hex) > 0.5 ? "var(--ink)" : "var(--on-accent)";
}

// --- Occurrences in ------------------------------------------------------------------------------

/**
 * FullCalendar's events for `occurrences`: only those on a visible calendar
 * the list knows (a calendar still loading, or just deleted, shows nothing),
 * each in its calendar's colour, with the occurrence itself in
 * `extendedProps.occurrence` for the clicks and drags to read back.
 */
export function toEventInputs(occurrences: readonly Occurrence[], calendars: readonly Calendar[]): EventInput[] {
  const byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const events: EventInput[] = [];
  for (const occurrence of occurrences) {
    const calendar = byId.get(occurrence.calendarId);
    if (!calendar?.visible) continue;
    const color = calendarColor(calendar);
    events.push({
      id: occurrence.id,
      title: displayTitle(occurrence.title),
      start: occurrence.start,
      end: occurrence.end,
      allDay: occurrence.allDay,
      color,
      contrastColor: eventInk(color),
      extendedProps: { occurrence },
    });
  }
  return events;
}

// --- FullCalendar's dates out ----------------------------------------------------------------------

function instantOf(date: Date): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime());
}

/** The date `date` falls on in `timeZone`. */
export function plainDateOf(date: Date, timeZone: string): Temporal.PlainDate {
  return instantOf(date).toZonedDateTimeISO(timeZone).toPlainDate();
}

/** A span on the wire, as quick create and a patch take it. */
export interface WireSpan {
  start: string;
  end: string;
  allDay: boolean;
}

/**
 * What a selection or a moved event covers, on the wire. FullCalendar can
 * leave the end out after a drag between the all-day row and the hours; it
 * is then a day, or an hour, as FullCalendar draws it.
 */
export function wireSpan(start: Date, end: Date | null, allDay: boolean, timeZone: string): WireSpan {
  if (allDay) {
    const first = plainDateOf(start, timeZone);
    const after = end ? plainDateOf(end, timeZone) : first.add({ days: 1 });
    const last = Temporal.PlainDate.compare(after, first) > 0 ? after : first.add({ days: 1 });
    return { start: first.toString(), end: last.toString(), allDay };
  }
  const from = instantOf(start);
  const to = end && end.getTime() > start.getTime() ? instantOf(end) : from.add({ milliseconds: HOUR_MS });
  return { start: wireInstant(from), end: wireInstant(to), allDay };
}

/**
 * A click on the hours selects one 15-minute snap; Google makes a click an
 * hour. The end such a selection should have instead, or `null` when it was
 * a drag (or all-day) and stands as it is.
 */
export function clickEnd(start: Date, end: Date, allDay: boolean, snapMs: number): Date | null {
  if (allDay || end.getTime() - start.getTime() !== snapMs) return null;
  return new Date(start.getTime() + HOUR_MS);
}

/** The changes a drag or resize makes: the new start and end, and `allDay` when it moved between the all-day row and the hours. */
export function moveChanges(occurrence: Pick<Occurrence, "allDay">, span: WireSpan): EventPatchBody["changes"] {
  return span.allDay === occurrence.allDay
    ? { start: span.start, end: span.end }
    : { start: span.start, end: span.end, allDay: span.allDay };
}

/**
 * The patch for an occurrence: a one-off takes its changes alone; a series'
 * occurrence (or an exception) also says the scope and which occurrence it
 * is, by its original start.
 */
export function occurrencePatch(
  occurrence: Pick<Occurrence, "seriesId" | "originalStart" | "start">,
  changes: EventPatchBody["changes"],
  scope: EditScope | null,
): EventPatchBody {
  if (occurrence.seriesId === null || scope === null) return { changes };
  return { scope, occurrence: occurrence.originalStart ?? occurrence.start, changes };
}
