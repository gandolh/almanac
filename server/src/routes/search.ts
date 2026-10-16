import { SEARCH_LIMIT, compareOccurrences, dateInZone, searchQuerySchema, type SearchResponse } from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { currentUserId } from "../auth/guard.js";
import { isSeries, rowOccurrence, searchOccurrence } from "../recurrence/expand.js";
import { seriesRepeats } from "./occurrences.js";

/**
 * `GET /api/search?q`: up to `SEARCH_LIMIT` of the user's events whose
 * title, location or notes contain `q`, case and diacritics folded
 * (`store/search-text.ts`), by start in their display time zone. The store
 * answers every matching row and the order is settled here, because an
 * all-day row's place among timed ones depends on the zone.
 *
 * A one-off event is itself. A series appears once, as its next occurrence
 * (the first that has not ended now), or its last one when it is over
 * (`searchOccurrence`), `s<seriesId>:<key>`. An exception whose own text
 * matches appears as itself, `e<id>`, wherever it is, beside its series.
 */
export const searchRoutes: FastifyPluginAsync<FeatureContext> = async (app, { events, settings }) => {
  app.get("/api/search", (request): SearchResponse => {
    const userId = currentUserId(request);
    const { q } = searchQuerySchema.parse(request.query);
    const { timeZone } = settings.get(userId);
    const now = Date.now();
    const today = dateInZone(now, timeZone);
    const repeatOf = seriesRepeats(events, userId);
    const results = [];
    for (const row of events.search(userId, q)) {
      if (isSeries(row)) {
        const next = searchOccurrence(row, events.listExceptions(userId, row.id), now, today);
        if (next) results.push(next);
      } else {
        results.push(rowOccurrence(row, row.seriesId === null ? null : repeatOf(row.seriesId)));
      }
    }
    return { results: results.sort(compareOccurrences(timeZone)).slice(0, SEARCH_LIMIT) };
  });
};
