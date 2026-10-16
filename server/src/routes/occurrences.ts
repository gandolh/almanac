import {
  allDayRange,
  compareOccurrences,
  eventOccurrenceId,
  occurrenceQuerySchema,
  parseInstant,
  type Occurrence,
  type OccurrenceList,
} from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { currentUserId } from "../auth/guard.js";
import type { EventRecord } from "../store/events.js";

/**
 * A stored row as the occurrence the views show: a one-off event, or an
 * exception of a series (with its `seriesId` and `originalStart`). `repeat`
 * is null: no route stores a repeat until brief 04, which fills an
 * exception's from its series.
 */
export function rowOccurrence(event: EventRecord): Occurrence {
  return {
    id: eventOccurrenceId(event.id),
    eventId: event.id,
    seriesId: event.seriesId,
    originalStart: event.originalStart,
    calendarId: event.calendarId,
    title: event.title,
    location: event.location,
    notes: event.notes,
    allDay: event.allDay,
    start: event.start,
    end: event.end,
    repeat: null,
  };
}

/**
 * `GET /api/occurrences?from&to` (brief 03): the user's stored rows that
 * overlap the instants `[from, to)`, by start in their display time zone.
 * All-day rows are matched on the dates the range covers in that zone
 * (`allDayRange`). Series are brief 04's; until then nothing stores one.
 */
export const occurrenceRoutes: FastifyPluginAsync<FeatureContext> = async (app, { events, settings }) => {
  app.get("/api/occurrences", (request): OccurrenceList => {
    const userId = currentUserId(request);
    const query = occurrenceQuerySchema.parse(request.query);
    const from = parseInstant(query.from);
    const to = parseInstant(query.to);
    const { timeZone } = settings.get(userId);
    const rows = events.listInRange(userId, { from, to, dates: allDayRange(from, to, timeZone) });
    return { occurrences: rows.map(rowOccurrence).sort(compareOccurrences(timeZone)) };
  });
};
