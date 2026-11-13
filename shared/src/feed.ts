import { z } from "zod";

/**
 * The calendar feed: one private link per user that a phone's calendar app
 * subscribes to, holding every event of every one of the user's calendars,
 * read-only and without reminders. The link carries a secret the server keeps
 * only as a hash, so it is shown once, when it is made.
 *
 *   GET    /api/feed                      → `FeedState`
 *   POST   /api/feed                      → 201 `FeedLink` (a new link; the old one stops working)
 *   DELETE /api/feed                      → 204 (off; the link stops working)
 *   GET    /api/feed/:token/almanac.ics   → the feed itself, `text/calendar`, no session
 */

/** Whether the user's feed is on, and since when (a UTC ISO timestamp). */
export const feedStateSchema = z.object({
  on: z.boolean(),
  createdAt: z.string().nullable(),
});
export type FeedState = z.infer<typeof feedStateSchema>;

/** A link just made: the only time the server can tell it, since it keeps only its hash. */
export const feedLinkSchema = z.object({
  url: z.string(),
  createdAt: z.string(),
});
export type FeedLink = z.infer<typeof feedLinkSchema>;
