import { pushKeySchema, pushTestResultSchema, type PushSubscriptionInput, type PushTestResult } from "@almanac/shared";
import { apiRequest, type RequestOptions } from "../api";

/**
 * The push routes (brief 14, `server/src/routes/push.ts`). With push off on
 * the server, the key, the save and the test reject with an `ApiError` whose
 * code is `not_found`.
 */

/** The server's VAPID public key, which this browser subscribes with. */
export async function getPushKey(): Promise<string> {
  return (await apiRequest("/api/push/key", { schema: pushKeySchema })).publicKey;
}

/** Keep this browser's subscription for the signed-in user. */
export function savePushSubscription(body: PushSubscriptionInput): Promise<void> {
  return apiRequest("/api/push/subscriptions", { method: "PUT", body });
}

/** Forget this browser's subscription. One the user doesn't have is still a success. */
export function deletePushSubscription(endpoint: string, options: Pick<RequestOptions, "signal"> = {}): Promise<void> {
  return apiRequest("/api/push/subscriptions", { method: "DELETE", body: { endpoint }, signal: options.signal });
}

/** Send the test notification to every browser the user turned notifications on in. */
export function sendTestPush(): Promise<PushTestResult> {
  return apiRequest("/api/push/test", { method: "POST", schema: pushTestResultSchema });
}
