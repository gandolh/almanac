import type { PushPayload } from "@almanac/shared";
import type { FastifyBaseLogger } from "fastify";
import type { VapidKeys } from "../config.js";
import type { PushSubscriptionStore, StoredPushSubscription } from "../store/push-subscriptions.js";
import { webPushSender, type SendPush } from "./sender.js";

/**
 * Web Push for one user's browsers (brief 14). The test route calls
 * `sendToUser`; so does brief 16's reminder timer.
 */
export interface PushService {
  /** The VAPID public key browsers subscribe with. */
  readonly publicKey: string;
  /**
   * Sends `payload` to every subscription the user has, all at once. Never
   * throws: a push that fails is logged, and a 404 or 410 from the push
   * service deletes that subscription. Nothing is retried. Resolves to how
   * many the push services took.
   */
  sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number }>;
}

export interface PushServiceDeps {
  vapid: VapidKeys;
  subscriptions: PushSubscriptionStore;
  log: Pick<FastifyBaseLogger, "info" | "warn">;
  /** The push itself. Default web-push (`webPushSender`); tests hand in a fake. */
  send?: SendPush;
}

/** A push service's answer that means the subscription is gone for good. */
const GONE: ReadonlySet<number> = new Set([404, 410]);

function statusOf(error: unknown): number | undefined {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" ? status : undefined;
}

/** Only the push service's host is logged: the whole endpoint addresses one device. */
function pushServiceOf(endpoint: string): string {
  return URL.canParse(endpoint) ? new URL(endpoint).host : "unknown";
}

export function createPushService({ vapid, subscriptions, log, send = webPushSender(vapid) }: PushServiceDeps): PushService {
  async function deliver(userId: string, sub: StoredPushSubscription, payload: string): Promise<boolean> {
    const details = { userId, pushService: pushServiceOf(sub.endpoint) };
    try {
      await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
    } catch (error) {
      const statusCode = statusOf(error);
      if (statusCode !== undefined && GONE.has(statusCode)) {
        subscriptions.forget(sub.endpoint);
        log.info({ ...details, statusCode }, "push subscription expired; deleted");
      } else {
        log.warn({ ...details, statusCode, reason: error instanceof Error ? error.message : String(error) }, "push not delivered");
      }
      return false;
    }
    subscriptions.markDelivered(sub.endpoint);
    return true;
  }

  return {
    publicKey: vapid.publicKey,
    async sendToUser(userId, payload) {
      const body = JSON.stringify(payload);
      const results = await Promise.all(subscriptions.list(userId).map((sub) => deliver(userId, sub, body)));
      return { sent: results.filter(Boolean).length };
    },
  };
}
