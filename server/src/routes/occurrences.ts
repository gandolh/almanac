import {
  allDayRange,
  compareOccurrences,
  occurrenceQuerySchema,
  parseInstant,
  type Occurrence,
  type OccurrenceList,
  type Repeat,
} from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { currentUserId } from "../auth/guard.js";
import { expandSeries, isSeries, rowOccurrence, seriesRepeat } from "../recurrence/expand.js";
import type { EventStore } from "../store/events.js";

/** The repeat of each series asked about (an exception's), read once per request. */
export function seriesRepeats(events: EventStore, userId: string): (seriesId: number) => Repeat | null {
  const known = new Map<number, Repeat | null>();
  return (seriesId) => {
    let repeat = known.get(seriesId);
    if (repeat === undefined) {
      const series = events.get(userId, seriesId);
      repeat = series && isSeries(series) ? seriesRepeat(series) : null;
      known.set(seriesId, repeat);
    }
    return repeat;
  };
}

/**
 * `GET /api/occurrences?from&to`: every occurrence of the user's events that
 * overlaps the instants `[from, to)`, by start in their display time zone.
 * All-day ones are matched on the dates the range covers in that zone
 * (`allDayRange`).
 *
 * - One-off events, as stored: `e<id>`.
 * - Each series' generated occurrences (`expandSeries`): `s<seriesId>:<key>`,
 *   `eventId` the series, `originalStart` the key, less its excluded dates and
 *   the keys its exceptions replace.
 * - Exceptions, as stored, wherever they were moved to: `e<id>`, with
 *   `seriesId`, `originalStart` and the series' `repeat`.
 */
export const occurrenceRoutes: FastifyPluginAsync<FeatureContext> = async (app, { events, settings }) => {
  app.get("/api/occurrences", (request): OccurrenceList => {
    const userId = currentUserId(request);
    const query = occurrenceQuerySchema.parse(request.query);
    const from = parseInstant(query.from);
    const to = parseInstant(query.to);
    const { timeZone } = settings.get(userId);
    const range = { from, to, dates: allDayRange(from, to, timeZone) };

    const found: Occurrence[] = [];
    const repeatOf = seriesRepeats(events, userId);
    for (const row of events.listInRange(userId, range)) {
      found.push(rowOccurrence(row, row.seriesId === null ? null : repeatOf(row.seriesId)));
    }
    for (const series of events.listSeries(userId, range)) {
      if (isSeries(series)) found.push(...expandSeries(series, events.listExceptions(userId, series.id), range));
    }
    return { occurrences: found.sort(compareOccurrences(timeZone)) };
  });
};
