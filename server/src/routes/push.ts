import {
  PUSH_TEST_TITLE,
  pushSubscriptionDeleteSchema,
  pushSubscriptionInputSchema,
  type PushKey,
  type PushTestResult,
} from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { currentUserId } from "../auth/guard.js";
import { ApiError } from "../errors.js";
import type { PushService } from "../push/push.js";

/**
 * The push routes (brief 14), behind the session like every route; the writes
 * pass the origin guard like every other write.
 *
 * With push off (no `VAPID_*` settings) there is no key to hand out, nothing
 * to subscribe to and nothing to send, so the key, the save and the test are
 * 404. Deleting still works, so a browser can always clean up after itself.
 */
export const pushRoutes: FastifyPluginAsync<FeatureContext> = async (app, { config, push, pushSubscriptions }) => {
  const pushOn = (): PushService => {
    if (push === undefined) throw new ApiError("not_found", "Notifications aren't set up on this server.");
    return push;
  };

  app.get("/api/push/key", (request): PushKey => {
    currentUserId(request);
    return { publicKey: pushOn().publicKey };
  });

  app.put("/api/push/subscriptions", (request, reply) => {
    const userId = currentUserId(request);
    pushOn();
    const { endpoint, keys } = pushSubscriptionInputSchema.parse(request.body);
    pushSubscriptions.save(userId, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
    return reply.code(204).send();
  });

  // Only the caller's own. Someone else's endpoint, or one already gone, is still a 204.
  app.delete("/api/push/subscriptions", (request, reply) => {
    const userId = currentUserId(request);
    const { endpoint } = pushSubscriptionDeleteSchema.parse(request.body);
    pushSubscriptions.remove(userId, endpoint);
    return reply.code(204).send();
  });

  // To every browser the caller turned notifications on in; a click opens the app.
  app.post("/api/push/test", async (request): Promise<PushTestResult> => {
    const userId = currentUserId(request);
    return pushOn().sendToUser(userId, {
      title: PUSH_TEST_TITLE,
      body: "Reminders for your events will show like this.",
      url: config.webBase,
      tag: "almanac-test",
    });
  });
};
