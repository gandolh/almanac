import { describe, expect, it } from "vitest";
import {
  PUSH_ENDPOINT_MAX_LENGTH,
  isPushEndpoint,
  pushPayloadSchema,
  pushSubscriptionDeleteSchema,
  pushSubscriptionInputSchema,
} from "./push.js";

// Shaped like a browser's PushSubscription.toJSON(); not a real subscription.
const endpoint = "https://fcm.googleapis.com/fcm/send/not-a-real-endpoint";
const keys = { p256dh: `B${"A".repeat(86)}`, auth: "A".repeat(22) };

describe("push subscriptions", () => {
  const parse = (body: unknown) => pushSubscriptionInputSchema.safeParse(body);

  it("takes a browser's subscription, padded keys too, and drops what it doesn't know", () => {
    expect(parse({ endpoint, expirationTime: 1767225600000, keys, extra: 1 }).data).toEqual({
      endpoint,
      expirationTime: 1767225600000,
      keys,
    });
    expect(parse({ endpoint, keys: { ...keys, auth: `${"A".repeat(22)}==` } }).success).toBe(true);
  });

  it("wants both keys, each the right size", () => {
    expect(parse({ endpoint }).success).toBe(false);
    expect(parse({ endpoint, keys: { ...keys, p256dh: "short" } }).success).toBe(false);
    expect(parse({ endpoint, keys: { ...keys, auth: "A".repeat(21) } }).success).toBe(false);
    expect(parse({ endpoint, keys: { ...keys, auth: "not base64url!" } }).success).toBe(false);
  });

  it.each([
    ["Chrome's", "https://fcm.googleapis.com/fcm/send/abc"],
    ["Firefox's", "https://updates.push.services.mozilla.com/wpush/v2/gAAAA"],
    ["Safari's", "https://web.push.apple.com/QGx"],
    ["a push service's name with a trailing dot", "https://fcm.googleapis.com./fcm/send/abc"],
  ])("accepts %s push service", (_label, value) => {
    expect(isPushEndpoint(value)).toBe(true);
  });

  it.each([
    ["plain http", "http://fcm.googleapis.com/fcm/send/abc"],
    ["credentials", "https://user:pass@fcm.googleapis.com/fcm/send/abc"],
    ["an IPv4 address", "https://10.0.0.5/push"],
    ["an IPv6 address", "https://[::1]/push"],
    ["localhost", "https://localhost/push"],
    ["localhost with a trailing dot", "https://localhost./push"],
    ["a single-label host", "https://almanac-api/push"],
    ["a .local name", "https://printer.local/push"],
    ["a .internal name", "https://metadata.google.internal/push"],
    ["no URL at all", "not a url"],
    ["an endpoint that is too long", `https://fcm.googleapis.com/${"a".repeat(PUSH_ENDPOINT_MAX_LENGTH)}`],
  ])("refuses %s", (_label, value) => {
    expect(isPushEndpoint(value)).toBe(false);
    expect(parse({ endpoint: value, keys }).success).toBe(false);
    expect(pushSubscriptionDeleteSchema.safeParse({ endpoint: value }).success).toBe(false);
  });
});

describe("pushPayloadSchema", () => {
  it("is a title, a body, a path to open and a tag", () => {
    const payload = { title: "Almanac notifications are on", body: "", url: "/almanac/", tag: "test" };
    expect(pushPayloadSchema.parse(payload)).toEqual(payload);
    expect(pushPayloadSchema.safeParse({ ...payload, url: "https://example.com/" }).success).toBe(false);
    expect(pushPayloadSchema.safeParse({ ...payload, title: "" }).success).toBe(false);
  });
});
