import { SEARCH_LIMIT, compareOccurrences, searchQuerySchema, type SearchResponse } from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { currentUserId } from "../auth/guard.js";
import { rowOccurrence } from "./occurrences.js";

/**
 * `GET /api/search?q` (brief 03): up to `SEARCH_LIMIT` of the user's events
 * whose title, location or notes contain `q`, case and diacritics folded
 * (`store/search-text.ts`), by start in their display time zone. The store
 * answers every match and the order is settled here, because an all-day
 * row's place among timed ones depends on the zone. Brief 04 changes what a
 * series contributes.
 */
export const searchRoutes: FastifyPluginAsync<FeatureContext> = async (app, { events, settings }) => {
  app.get("/api/search", (request): SearchResponse => {
    const userId = currentUserId(request);
    const { q } = searchQuerySchema.parse(request.query);
    const { timeZone } = settings.get(userId);
    const results = events.search(userId, q).map(rowOccurrence).sort(compareOccurrences(timeZone));
    return { results: results.slice(0, SEARCH_LIMIT) };
  });
};
