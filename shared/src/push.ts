import { z } from "zod";

/**
 * Web Push (brief 14): a browser's subscription, the routes that store it, and
 * what a push carries. One subscription per browser (its endpoint), kept for
 * the user who saved it last. The server signs every push with its VAPID key
 * pair; without one, push is off and the routes that need it answer 404.
 *
 *   GET    /api/push/key            → `PushKey`
 *   PUT    /api/push/subscriptions  `PushSubscriptionInput` → 204
 *   DELETE /api/push/subscriptions  `PushSubscriptionDelete` → 204
 *   POST   /api/push/test           → `PushTestResult`
 */

/** The longest endpoint the server stores. Real push services use well under 1 KB. */
export const PUSH_ENDPOINT_MAX_LENGTH = 2048;

/** A user keeps at most this many subscriptions (browsers); saving one more drops the oldest. */
export const PUSH_SUBSCRIPTIONS_PER_USER = 5;

const IPV4_HOST = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Whether `value` could be a push service's endpoint: an https URL with no
 * credentials on a public DNS name. IP literals, `localhost` and single-label
 * hosts (a Docker service name) are refused, so nobody can point the server's
 * pushes at something on its own network. Trailing dots are dropped before
 * the name is judged: `localhost.` resolves like `localhost`.
 */
export function isPushEndpoint(value: string): boolean {
  if (value.length > PUSH_ENDPOINT_MAX_LENGTH || !URL.canParse(value)) return false;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (host.startsWith("[") || IPV4_HOST.test(host) || !host.includes(".")) return false;
  return host !== "localhost" && !host.endsWith(".localhost") && !host.endsWith(".local") && !host.endsWith(".internal");
}

const endpointSchema = z
  .string({ error: "a push subscription needs an endpoint" })
  .refine(isPushEndpoint, { message: "must be a push service's https URL" });

// The browser's keys, base64url (some browsers pad). p256dh is a 65-byte P-256
// point (87 characters), auth 16 bytes (22 characters) or more.
const base64url = /^[A-Za-z0-9_-]+={0,2}$/;
const keysSchema = z.object(
  {
    p256dh: z
      .string()
      .regex(base64url, { message: "must be base64url" })
      .refine((value) => value.replace(/=+$/, "").length === 87, { message: "must be a 65-byte P-256 key" }),
    auth: z
      .string()
      .regex(base64url, { message: "must be base64url" })
      .refine((value) => value.replace(/=+$/, "").length >= 22 && value.length <= 64, { message: "must be 16 bytes or more" }),
  },
  { error: "a push subscription needs keys.p256dh and keys.auth" },
);

/** `GET /api/push/key`: the server's VAPID public key (base64url), for `pushManager.subscribe`. */
export const pushKeySchema = z.object({ publicKey: z.string().min(1) });
export type PushKey = z.infer<typeof pushKeySchema>;

/**
 * `PUT /api/push/subscriptions`: the browser's `PushSubscription.toJSON()`.
 * `expirationTime` is accepted and ignored. Saving an endpoint already stored
 * gives it to the caller, with the new keys.
 */
export const pushSubscriptionInputSchema = z.object({
  endpoint: endpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: keysSchema,
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;

/** `DELETE /api/push/subscriptions`: only the caller's own; an endpoint they don't have is still a 204. */
export const pushSubscriptionDeleteSchema = z.object({ endpoint: endpointSchema });
export type PushSubscriptionDelete = z.infer<typeof pushSubscriptionDeleteSchema>;

/** `POST /api/push/test`: how many of the caller's browsers the push service took the test for. */
export const pushTestResultSchema = z.object({ sent: z.number().int().min(0) });
export type PushTestResult = z.infer<typeof pushTestResultSchema>;

/** The test notification's title (`POST /api/push/test`). */
export const PUSH_TEST_TITLE = "Almanac notifications are on";

/**
 * What a push carries, as JSON. The service worker (`web/public/sw.js`) shows
 * `title` and `body`; a click focuses an Almanac window and takes it to
 * `url`, or opens one there. `url` is a path under the web app's base. A
 * notification with the same `tag` replaces the one before it.
 */
export const pushPayloadSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  url: z.string().startsWith("/"),
  tag: z.string().min(1),
});
export type PushPayload = z.infer<typeof pushPayloadSchema>;
