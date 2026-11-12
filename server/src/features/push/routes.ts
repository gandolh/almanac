import {
  PUSH_TEST_TITLE,
  pushKeySchema,
  pushSubscriptionDeleteSchema,
  pushSubscriptionInputSchema,
  pushTestResultSchema,
} from "@almanac/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { Config } from "../../config.js";
import { ApiError } from "../../lib/api-error.js";
import { currentUserId } from "../../plugins/auth/guard.js";
import type { PushService } from "./service.js";
import type { PushSubscriptionStore } from "./store.js";

/** What the push routes take from the app. */
export interface PushRoutesOptions {
  config: Config;
  /** `undefined` when push is off (no VAPID keys). */
  push: PushService | undefined;
  pushSubscriptions: PushSubscriptionStore;
}

/**
 * The push routes, behind the session like every route; the writes
 * pass the origin guard like every other write.
 *
 * With push off (no `VAPID_*` settings) there is no key to hand out, nothing
 * to subscribe to and nothing to send, so the key, the save and the test are
 * 404. Deleting still works, so a browser can always clean up after itself.
 */
export const pushRoutes: FastifyPluginAsyncZod<PushRoutesOptions> = async (
  app,
  { config, push, pushSubscriptions },
) => {
  const pushOn = (): PushService => {
    if (push === undefined) throw new ApiError("not_found", "Notifications aren't set up on this server.");
    return push;
  };

  app.get("/api/push/key", { schema: { response: { 200: pushKeySchema } } }, (request) => {
    currentUserId(request);
    return { publicKey: pushOn().publicKey };
  });

  app.put(
    "/api/push/subscriptions",
    { schema: { body: pushSubscriptionInputSchema, response: { 204: z.null() } } },
    (request, reply) => {
      const userId = currentUserId(request);
      pushOn();
      const { endpoint, keys } = request.body;
      pushSubscriptions.save(userId, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
      reply.code(204);
      return null;
    },
  );

  // Only the caller's own. Someone else's endpoint, or one already gone, is still a 204.
  app.delete(
    "/api/push/subscriptions",
    { schema: { body: pushSubscriptionDeleteSchema, response: { 204: z.null() } } },
    (request, reply) => {
      const userId = currentUserId(request);
      pushSubscriptions.remove(userId, request.body.endpoint);
      reply.code(204);
      return null;
    },
  );

  // To every browser the caller turned notifications on in; a click opens the app.
  app.post("/api/push/test", { schema: { response: { 200: pushTestResultSchema } } }, async (request) => {
    const userId = currentUserId(request);
    return pushOn().sendToUser(userId, {
      title: PUSH_TEST_TITLE,
      body: "Reminders for your events will show like this.",
      url: config.webBase,
      tag: "almanac-test",
    });
  });
};
