import webpush, { type RequestOptions, type SendResult } from "web-push";
import type { VapidKeys } from "../config.js";

/**
 * How long a push service keeps a push the device hasn't picked up: an hour.
 * A reminder is about a time; one that turns up the next morning is noise.
 */
export const PUSH_TTL_SECONDS = 60 * 60;
/** Socket timeout for one request to a push service. */
export const PUSH_TIMEOUT_MS = 10_000;

/** Where one push goes: a stored subscription. */
export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Encrypts and sends one push. Resolves when the push service took it;
 * rejects otherwise, with the service's HTTP status as `statusCode` when it
 * answered (web-push's `WebPushError`).
 */
export type SendPush = (target: PushTarget, payload: string) => Promise<void>;

type SendNotification = (subscription: PushTarget, payload: string, options: RequestOptions) => Promise<SendResult>;

/**
 * The real sender, copied from Satchel's (`../satchel/server/src/push/sender.ts`):
 * web-push with the VAPID keys passed on every call (no `setVapidDetails`, so
 * no module-wide state) and aes128gcm, web-push's default and the only
 * encoding Apple takes. Urgency is high, not Satchel's normal: a phone saving
 * its battery holds a normal push back, and a reminder is only any use on time.
 */
export function webPushSender(vapid: VapidKeys, sendNotification: SendNotification = webpush.sendNotification): SendPush {
  const options: RequestOptions = {
    vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    TTL: PUSH_TTL_SECONDS,
    urgency: "high",
    timeout: PUSH_TIMEOUT_MS,
  };
  return async (target, payload) => {
    await sendNotification(target, payload, options);
  };
}
