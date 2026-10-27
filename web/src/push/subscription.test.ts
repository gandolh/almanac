import { describe, expect, it } from "vitest";
import { base64UrlToBytes, isIos, openRequestPath, pushSupport, sameKey, subscriptionBody, workerUrl, type PushEnvironment } from "./subscription";

const CHROME: PushEnvironment = {
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  platform: "Linux x86_64",
  maxTouchPoints: 0,
  standalone: false,
  serviceWorker: true,
  pushManager: true,
  notification: true,
};
const IPHONE: PushEnvironment = {
  ...CHROME,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
  maxTouchPoints: 5,
};

describe("pushSupport", () => {
  it("is ok in a browser with service workers, Push and notifications", () => {
    expect(pushSupport(CHROME)).toBe("ok");
    expect(pushSupport({ ...CHROME, pushManager: false })).toBe("unsupported");
    expect(pushSupport({ ...CHROME, notification: false })).toBe("unsupported");
  });

  it("sends an iPhone in a Safari tab to the Home Screen first", () => {
    expect(pushSupport({ ...IPHONE, pushManager: false, notification: false })).toBe("ios-home-screen");
    expect(pushSupport({ ...IPHONE, standalone: true })).toBe("ok");
    expect(pushSupport({ ...IPHONE, standalone: true, pushManager: false })).toBe("ios-update");
  });

  it("knows an iPad that says it is a Mac", () => {
    expect(isIos({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
  });
});

describe("the subscription", () => {
  it("turns a base64url key into its bytes, with or without padding", () => {
    expect([...base64UrlToBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
    expect([...base64UrlToBytes("AQI=")]).toEqual([1, 2]);
  });

  it("tells whether a subscription was made with the server's key", () => {
    const key = new Uint8Array([1, 2, 3]);
    expect(sameKey(new Uint8Array([1, 2, 3]).buffer, key)).toBe(true);
    expect(sameKey(new Uint8Array([1, 2, 4]).buffer, key)).toBe(false);
    expect(sameKey(new Uint8Array([1, 2]).buffer, key)).toBe(false);
    expect(sameKey(null, key)).toBe(false);
  });

  it("is the request body only with both keys", () => {
    const keys = { p256dh: "p", auth: "a" };
    expect(subscriptionBody({ endpoint: "https://push.example/1", keys })).toEqual({
      endpoint: "https://push.example/1",
      expirationTime: null,
      keys,
    });
    expect(subscriptionBody({ endpoint: "https://push.example/1", keys: { p256dh: "p" } })).toBeNull();
    expect(subscriptionBody({ keys })).toBeNull();
  });
});

describe("the worker", () => {
  it("is served at the app's base", () => {
    expect(workerUrl("/almanac/")).toBe("/almanac/sw.js");
    expect(workerUrl("/")).toBe("/sw.js");
  });

  it("asks the app to go to a path inside it, and nowhere else", () => {
    const origin = "https://almanac.example";
    const open = (url: unknown) => openRequestPath({ type: "almanac:open", url }, origin, "/almanac/");
    expect(open("https://almanac.example/almanac/day/2026/10/27")).toBe("/almanac/day/2026/10/27");
    expect(open("https://almanac.example/almanac/search?q=gym")).toBe("/almanac/search?q=gym");
    expect(open("https://elsewhere.example/almanac/day/2026/10/27")).toBeNull();
    expect(open("https://almanac.example/other-app/")).toBeNull();
    expect(open("not a url")).toBeNull();
    expect(openRequestPath({ type: "something-else", url: "https://almanac.example/almanac/" }, origin, "/almanac/")).toBeNull();
    expect(openRequestPath(null, origin, "/almanac/")).toBeNull();
  });
});
