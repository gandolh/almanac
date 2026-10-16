import { SEARCH_QUERY_MAX, searchResponseSchema, type Occurrence } from "@almanac/shared";
import { apiRequest, type RequestOptions } from "../api";

/**
 * `GET /api/search?q` (brief 03): the user's events whose title, location or
 * notes contain the words, case and diacritics folded on the server, so
 * "sedinta" finds "Ședință". A series answers once, at its next occurrence.
 */

/**
 * The query as it is sent: trimmed and cut to what the server accepts (a
 * deep link can carry any `?q=`; the search box stops typing at the limit).
 */
export function normalizeQuery(raw: string): string {
  return raw.trim().slice(0, SEARCH_QUERY_MAX).trim();
}

/** The API path of a search for `query`, which must already be normalized. */
export function searchPath(query: string): string {
  return `/api/search?${new URLSearchParams({ q: query }).toString()}`;
}

/** The matching occurrences, in the order the server gives (by date in the display time zone). */
export async function searchEvents(query: string, options: Pick<RequestOptions, "signal"> = {}): Promise<Occurrence[]> {
  const answer = await apiRequest(searchPath(normalizeQuery(query)), { schema: searchResponseSchema, signal: options.signal });
  return answer.results;
}
