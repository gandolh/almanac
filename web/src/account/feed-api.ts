import { feedLinkSchema, feedStateSchema, type FeedLink, type FeedState } from "@almanac/shared";
import { apiRequest } from "../api";

/** The calendar feed's routes (`server/src/features/feed/routes.ts`), for the account menu's "Calendar feed…". */

/** Whether the signed-in user's feed is on, and since when. */
export function getFeedState(): Promise<FeedState> {
  return apiRequest("/api/feed", { schema: feedStateSchema });
}

/** A new link, which turns the feed on and ends any earlier link. The only time the link can be shown. */
export function makeFeedLink(): Promise<FeedLink> {
  return apiRequest("/api/feed", { method: "POST", schema: feedLinkSchema });
}

/** Turn the feed off: its link stops working. */
export function turnFeedOff(): Promise<void> {
  return apiRequest("/api/feed", { method: "DELETE" });
}
