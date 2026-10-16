import { z } from "zod";
import { occurrenceSchema } from "./event.js";

/** Search over the user's events by title, location and notes, diacritics and case folded on the server. */

export const SEARCH_QUERY_MAX = 100;
/** The most results one search answers. */
export const SEARCH_LIMIT = 50;

/** `GET /api/search?q`: 1-100 characters once trimmed. */
export const searchQuerySchema = z.object({
  q: z
    .string({ error: "type something to search for" })
    .trim()
    .min(1, { message: "type something to search for" })
    .max(SEARCH_QUERY_MAX, { message: `must be at most ${SEARCH_QUERY_MAX} characters` }),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/**
 * What a search answers: up to `SEARCH_LIMIT` matching occurrences, by start
 * in the user's display time zone (`compareOccurrences`). With more matches,
 * the ones closest to now: those not over yet, then the latest past ones. A
 * series contributes one occurrence (brief 04).
 */
export const searchResponseSchema = z.object({ results: z.array(occurrenceSchema) });
export type SearchResponse = z.infer<typeof searchResponseSchema>;
