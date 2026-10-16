import {
  SEARCH_LIMIT,
  compareOccurrences,
  dateInZone,
  parseInstant,
  searchQuerySchema,
  type Occurrence,
  type SearchResponse,
} from "@almanac/shared";
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
 * With more matches than that, the ones closest to now win: those that have
 * not ended yet, soonest first, then the past ones, latest first. The ones
 * kept are then put back in date order.
 *
 * A one-off event is itself. A series appears once, as its next occurrence
 * (the first that has not ended now), or its last one when it is over
 * (`searchOccurrence`), `s<seriesId>:<key>`. An exception whose own text
 * matches appears as itself, `e<id>`, wherever it is, beside its series.
 *
 * A row whose occurrence can't be worked out is logged and left out; the
 * rest still answers, as in `GET /api/occurrences`.
 */
export const searchRoutes: FastifyPluginAsync<FeatureContext> = async (app, { events, settings }) => {
  app.get("/api/search", (request): SearchResponse => {
    const userId = currentUserId(request);
    const { q } = searchQuerySchema.parse(request.query);
    const { timeZone } = settings.get(userId);
    const now = Date.now();
    const today = dateInZone(now, timeZone);
    const repeatOf = seriesRepeats(events, userId);
    const upcoming: Occurrence[] = [];
    const past: Occurrence[] = [];
    // Not ended at `now`, as `searchOccurrence` picks a series' occurrence: an all-day one by `today`.
    const sortOut = (found: Occurrence) =>
      (found.allDay ? found.end > today : parseInstant(found.end) > now) ? upcoming.push(found) : past.push(found);
    for (const row of events.search(userId, q)) {
      try {
        if (isSeries(row)) {
          const next = searchOccurrence(row, events.listExceptions(userId, row.id), now, today);
          if (next) sortOut(next);
        } else {
          sortOut(rowOccurrence(row, row.seriesId === null ? null : repeatOf(row.seriesId)));
        }
      } catch (err) {
        // One bad row (a rule or a length the expansion can't take) costs its own result, not the whole search.
        request.log.error({ err, eventId: row.id }, "skipped an event search could not place");
      }
    }
    const byStart = compareOccurrences(timeZone);
    const closest = [...upcoming.sort(byStart), ...past.sort((a, b) => byStart(b, a))].slice(0, SEARCH_LIMIT);
    return { results: closest.sort(byStart) };
  });
};
