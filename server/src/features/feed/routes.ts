import { createHash } from "node:crypto";
import { feedLinkSchema, feedStateSchema } from "@almanac/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { Config } from "../../config.js";
import { ApiError } from "../../lib/api-error.js";
import { currentUserId } from "../../plugins/auth/guard.js";
import { NOT_FOUND_MESSAGE } from "../../plugins/errors.js";
import type { EventStore } from "../events/index.js";
import type { SettingsStore } from "../settings/index.js";
import { feedCalendar } from "./calendar.js";
import type { FeedTokenStore } from "./store.js";
import { generateFeedToken, isFeedTokenShaped } from "./token.js";

/** The feed itself, as Fastify sees it. `PUBLIC_ROUTES` (`plugins/auth`) names it, so it needs no session. */
const FEED_ROUTE = "/api/feed/:token/almanac.ics";

/** How many times a minute one address may fetch a feed (any feed, any token). */
export const FEED_RATE_LIMIT = { max: 30, timeWindow: "1 minute" } as const;

/** What the feed routes take from the app. */
export interface FeedRoutesOptions {
  config: Pick<Config, "publicOrigin" | "apiPrefix">;
  events: EventStore;
  settings: SettingsStore;
  feedTokens: FeedTokenStore;
  /** The clock: the year each `VTIMEZONE` reads its rules from. */
  now?: () => Date;
}

/** Whether an `If-None-Match` header names `etag` (or is `*`). Weak tags compare by their value. */
function matches(header: string | undefined, etag: string): boolean {
  if (header === undefined) return false;
  return header.split(",").some((tag) => {
    const value = tag.trim().replace(/^W\//, "");
    return value === "*" || value === etag;
  });
}

/**
 * The calendar feed: a private link per user that a phone's calendar app
 * subscribes to (`shared/src/feed.ts`).
 *
 * The three `/api/feed` routes are the signed-in user's, like every route:
 * whether the feed is on, a new link (which ends the old one), and off. The
 * link itself is answered from its token alone. It never reads the session,
 * answers `GET` (and `HEAD`) only, sends no CORS header, is limited per
 * address, and answers a token that is malformed, unknown, replaced or turned
 * off with the same 404 as a route that doesn't exist.
 */
export const feedRoutes: FastifyPluginAsyncZod<FeedRoutesOptions> = async (
  app,
  { config, events, settings, feedTokens, now = () => new Date() },
) => {
  const linkTo = (token: string) =>
    `${config.publicOrigin}${config.apiPrefix}${FEED_ROUTE.replace(":token", encodeURIComponent(token))}`;

  app.get("/api/feed", { schema: { response: { 200: feedStateSchema } } }, (request) =>
    feedTokens.state(currentUserId(request)),
  );

  app.post("/api/feed", { schema: { response: { 201: feedLinkSchema } } }, (request, reply) => {
    const userId = currentUserId(request);
    const token = generateFeedToken();
    const createdAt = feedTokens.replace(userId, token);
    // The link is a secret: no cache keeps this answer.
    reply.code(201).header("cache-control", "no-store");
    return { url: linkTo(token), createdAt };
  });

  app.delete("/api/feed", { schema: { response: { 204: z.null() } } }, (request, reply) => {
    feedTokens.remove(currentUserId(request));
    reply.code(204);
    return null;
  });

  // A string reply skips the serializer, so this route declares no response schema (scripts/conventions.json).
  app.get(
    FEED_ROUTE,
    {
      // A plain string: a token of the wrong shape is the same 404 as a wrong token, never a 400.
      schema: { params: z.object({ token: z.string() }) },
      config: { rateLimit: FEED_RATE_LIMIT },
    },
    (request, reply) => {
      const { token } = request.params;
      const userId = isFeedTokenShaped(token) ? feedTokens.userFor(token) : undefined;
      if (userId === undefined) throw new ApiError("not_found", NOT_FOUND_MESSAGE);

      const body = feedCalendar({
        events: events.listAll(userId),
        timeZone: settings.get(userId).timeZone,
        now: now(),
      });
      const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
      reply
        // Only the subscriber's own cache, and only after asking again (the ETag makes that cheap).
        .header("cache-control", "private, no-cache")
        .header("etag", etag)
        .header("x-content-type-options", "nosniff")
        .header("x-robots-tag", "noindex, nofollow");
      if (matches(request.headers["if-none-match"], etag)) return reply.code(304).send();
      return reply.code(200).type("text/calendar; charset=utf-8").send(body);
    },
  );
};
