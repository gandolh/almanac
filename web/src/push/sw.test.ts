import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `web/public/sw.js`, the push-only worker, run as it is against a stand-in
 * `self`: its handlers are what it registered, and the registration and the
 * windows are fakes that record what the worker asked of them.
 */

const SOURCE = readFileSync(fileURLToPath(new URL("../../public/sw.js", import.meta.url)), "utf8");
const SCOPE = "https://almanac.example/almanac/";

interface FakeWindow {
  url: string;
  focused: boolean;
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
}

type Handler = (event: Record<string, unknown>) => void;

function fakeWindow(url: string, { focused = false, controlled = true } = {}): FakeWindow {
  const window: FakeWindow = {
    url,
    focused,
    focus: vi.fn(async () => window),
    navigate: vi.fn(async (to: string) => {
      if (!controlled) throw new TypeError("not controlled");
      window.url = to;
      return window;
    }),
    postMessage: vi.fn(),
  };
  return window;
}

let handlers: Map<string, Handler>;
let showNotification: ReturnType<typeof vi.fn>;
let openWindow: ReturnType<typeof vi.fn>;
let windows: FakeWindow[];
let skipWaiting: ReturnType<typeof vi.fn>;

beforeEach(() => {
  handlers = new Map();
  showNotification = vi.fn(async () => undefined);
  openWindow = vi.fn(async () => null);
  skipWaiting = vi.fn(async () => undefined);
  windows = [];
  const self = {
    registration: { scope: SCOPE, showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow, claim: vi.fn(async () => undefined) },
    skipWaiting,
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
  };
  runInNewContext(SOURCE, { self, URL });
});

/** Dispatch `type` and wait for what the worker handed `waitUntil`. */
async function dispatch(type: string, event: Record<string, unknown>): Promise<void> {
  let pending: Promise<unknown> = Promise.resolve();
  handlers.get(type)?.({ ...event, waitUntil: (promise: Promise<unknown>) => (pending = promise) });
  await pending;
}

const pushOf = (value: unknown) => ({ data: { json: () => value } });

describe("the worker", () => {
  it("listens for push and notificationclick, and has no fetch handler", () => {
    expect([...handlers.keys()].sort()).toEqual(["activate", "install", "notificationclick", "push"]);
  });

  it("takes over at once: it caches nothing, so there is nothing to wait for", async () => {
    await dispatch("install", {});
    expect(skipWaiting).toHaveBeenCalled();
  });

  it("shows the server's payload, with a click target inside the app", async () => {
    await dispatch("push", pushOf({ title: "Dentist, 14:30", body: "In 10 minutes", url: "/almanac/day/2026/10/27", tag: "r1" }));
    expect(showNotification).toHaveBeenCalledWith("Dentist, 14:30", {
      body: "In 10 minutes",
      icon: `${SCOPE}icons/icon-192.png`,
      tag: "r1",
      data: { url: `${SCOPE}day/2026/10/27` },
    });
  });

  it("still shows something for a push that isn't one of ours", async () => {
    for (const data of [pushOf({ hello: "there" }), { json: () => JSON.parse("not json") }, null]) {
      showNotification.mockClear();
      await dispatch("push", { data });
      expect(showNotification).toHaveBeenCalledWith("Almanac", expect.objectContaining({ data: { url: SCOPE } }));
    }
  });

  it("sends a click to a URL outside the app to the app's root", async () => {
    await dispatch("push", pushOf({ title: "x", body: "", url: "https://elsewhere.example/phish", tag: "t" }));
    expect(showNotification).toHaveBeenCalledWith("x", expect.objectContaining({ data: { url: SCOPE } }));
  });
});

describe("pressing a notification", () => {
  const press = (url: unknown) => {
    const close = vi.fn();
    return { close, done: dispatch("notificationclick", { notification: { close, data: { url } } }) };
  };

  it("opens Almanac at the URL when no Almanac window is open", async () => {
    windows = [fakeWindow("https://elsewhere.example/", { focused: true })];
    const { close, done } = press(`${SCOPE}day/2026/10/27`);
    await done;
    expect(close).toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(`${SCOPE}day/2026/10/27`);
  });

  it("focuses the window already there", async () => {
    const there = fakeWindow(`${SCOPE}day/2026/10/27`);
    const other = fakeWindow(`${SCOPE}month/2026/10/1`, { focused: true });
    windows = [other, there];
    await press(`${SCOPE}day/2026/10/27`).done;
    expect(there.focus).toHaveBeenCalled();
    expect(there.navigate).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("else brings an Almanac window forward and takes it to the URL", async () => {
    const back = fakeWindow(`${SCOPE}month/2026/10/1`);
    const front = fakeWindow(`${SCOPE}week/2026/10/26`, { focused: true });
    windows = [back, front];
    await press(`${SCOPE}day/2026/10/27`).done;
    expect(front.focus).toHaveBeenCalled();
    expect(front.navigate).toHaveBeenCalledWith(`${SCOPE}day/2026/10/27`);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("asks a window it can't move to move itself", async () => {
    const window = fakeWindow(`${SCOPE}month/2026/10/1`, { controlled: false });
    windows = [window];
    await press(`${SCOPE}day/2026/10/27`).done;
    expect(window.postMessage).toHaveBeenCalledWith({ type: "almanac:open", url: `${SCOPE}day/2026/10/27` });
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens the app's root for a notification with no usable URL", async () => {
    await press(undefined).done;
    expect(openWindow).toHaveBeenCalledWith(SCOPE);
  });
});
