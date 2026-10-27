import { PUSH_TEST_TITLE, pushPayloadSchema } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_TIMEOUT_MS, PUSH_TTL_SECONDS } from "../push/sender.js";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";
import { vapidEnv } from "../testing/vapid.js";

// The push services: web-push's one network call, answered here.
const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", () => ({ default: { sendNotification } }));

// Shaped like a browser's PushSubscription.toJSON(); not a real subscription.
const keys = { p256dh: `B${"A".repeat(86)}`, auth: "A".repeat(22) };
const subscription = (n: number) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`, expirationTime: null, keys });

let t: SignedInTestApp;

afterEach(async () => {
  await t.close();
  sendNotification.mockReset();
});

describe("/api/push with push off", () => {
  beforeEach(async () => {
    t = await startSignedInApp();
  });

  it("answers 401 without a session", async () => {
    for (const [method, url] of [
      ["GET", "/api/push/key"],
      ["PUT", "/api/push/subscriptions"],
      ["DELETE", "/api/push/subscriptions"],
      ["POST", "/api/push/test"],
    ] as const) {
      expect((await t.app.inject({ method, url })).statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("has no key, takes no subscription and sends no test, and says why", async () => {
    const key = await t.inject({ method: "GET", url: "/api/push/key" });
    expect(key.statusCode).toBe(404);
    expect(key.json()).toEqual({ error: { code: "not_found", message: "Notifications aren't set up on this server." } });
    expect((await t.inject({ method: "PUT", url: "/api/push/subscriptions", payload: subscription(1) })).statusCode).toBe(404);
    expect((await t.inject({ method: "POST", url: "/api/push/test" })).statusCode).toBe(404);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("still lets a browser delete its subscription", async () => {
    const res = await t.inject({ method: "DELETE", url: "/api/push/subscriptions", payload: { endpoint: subscription(1).endpoint } });
    expect(res.statusCode).toBe(204);
  });
});

describe("/api/push with the VAPID keys set", () => {
  let env: Record<string, string>;

  beforeEach(async () => {
    env = vapidEnv();
    t = await startSignedInApp(env);
    sendNotification.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
  });

  const save = (n: number, inject = t.inject) =>
    inject({ method: "PUT", url: "/api/push/subscriptions", payload: subscription(n) });
  const test = (inject = t.inject) => inject({ method: "POST", url: "/api/push/test" });
  const sentTo = () => sendNotification.mock.calls.map(([target]) => (target as { endpoint: string }).endpoint);

  it("hands out the public key", async () => {
    const res = await t.inject({ method: "GET", url: "/api/push/key" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ publicKey: env.VAPID_PUBLIC_KEY });
  });

  it("saves a subscription and sends the test to it, signed with the keys, with a click that opens the app", async () => {
    expect((await save(1)).statusCode).toBe(204);
    const res = await test();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sent: 1 });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [target, body, options] = sendNotification.mock.calls[0] ?? [];
    expect(target).toEqual({ endpoint: subscription(1).endpoint, keys });
    expect(pushPayloadSchema.parse(JSON.parse(body as string))).toEqual({
      title: PUSH_TEST_TITLE,
      body: "Reminders for your events will show like this.",
      url: "/almanac/",
      tag: "almanac-test",
    });
    expect(options).toEqual({
      vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
      TTL: PUSH_TTL_SECONDS,
      urgency: "high",
      timeout: PUSH_TIMEOUT_MS,
    });
  });

  it("sends to each of the caller's browsers and nobody else's", async () => {
    const other = await t.signInAs("other");
    await save(1);
    await save(2);
    await save(3, other.inject);
    expect((await test()).json()).toEqual({ sent: 2 });
    expect(sentTo().sort()).toEqual([subscription(1).endpoint, subscription(2).endpoint]);
  });

  it("sends nothing once the browser turned it off", async () => {
    await save(1);
    const res = await t.inject({ method: "DELETE", url: "/api/push/subscriptions", payload: { endpoint: subscription(1).endpoint } });
    expect(res.statusCode).toBe(204);
    expect((await test()).json()).toEqual({ sent: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("doesn't let one user delete another's subscription", async () => {
    const other = await t.signInAs("other");
    await save(1);
    const res = await other.inject({ method: "DELETE", url: "/api/push/subscriptions", payload: { endpoint: subscription(1).endpoint } });
    expect(res.statusCode).toBe(204);
    expect((await test()).json()).toEqual({ sent: 1 });
  });

  it("moves a browser to whoever signed in on it and saved it last", async () => {
    const other = await t.signInAs("other");
    await save(1);
    await save(1, other.inject);
    expect((await test()).json()).toEqual({ sent: 0 });
    expect((await test(other.inject)).json()).toEqual({ sent: 1 });
  });

  it("deletes a subscription the push service says is gone, and keeps one that only failed", async () => {
    await save(1);
    await save(2);
    sendNotification.mockImplementation(async (target: { endpoint: string }) => {
      if (target.endpoint === subscription(1).endpoint) throw Object.assign(new Error("Received unexpected response code"), { statusCode: 410 });
      throw Object.assign(new Error("Received unexpected response code"), { statusCode: 500 });
    });
    expect((await test()).json()).toEqual({ sent: 0 });

    sendNotification.mockReset();
    sendNotification.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
    expect((await test()).json()).toEqual({ sent: 1 });
    expect(sentTo()).toEqual([subscription(2).endpoint]);
  });

  it("refuses a subscription that isn't a push service's, and a write from another origin", async () => {
    for (const payload of [
      { ...subscription(1), endpoint: "https://10.0.0.5/push" },
      { endpoint: subscription(1).endpoint },
      { ...subscription(1), keys: { ...keys, p256dh: "short" } },
    ]) {
      const res = await t.inject({ method: "PUT", url: "/api/push/subscriptions", payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
    const cross = await t.inject({
      method: "PUT",
      url: "/api/push/subscriptions",
      payload: subscription(1),
      headers: { origin: "https://elsewhere.example" },
    });
    expect(cross.statusCode).toBe(403);
    expect((await test()).json()).toEqual({ sent: 0 });
  });
});
