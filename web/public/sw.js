/*
 * Almanac's service worker (brief 14): push only. It shows a push as a
 * notification and opens Almanac when the notification is pressed. It has no
 * fetch handler, so it caches nothing and how the app loads doesn't change:
 * still no offline (corpus/wiki/decisions.md).
 *
 * Plain JavaScript in public/: `vite dev` serves it as it is at <base>sw.js and
 * the build copies it there, with nothing to bundle. web/src/push/subscription.ts
 * registers it with the app's base as its scope, so every URL here resolves
 * against `self.registration.scope` and nothing is baked in at build time.
 * web/src/push/sw.test.ts runs this file against a stand-in worker.
 *
 * A push is the server's PushPayload (shared/src/push.ts), checked by hand:
 * there is no zod here.
 */

/** The app's root as a full URL, with its trailing slash: `https://…/almanac/`. */
function scope() {
  return self.registration.scope;
}

/** The push's payload when it is one of ours, else null. */
function readPayload(data) {
  let value;
  try {
    value = data ? data.json() : null;
  } catch {
    value = null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { title, body, url, tag } = value;
  if (typeof title !== "string" || title === "" || typeof body !== "string") return null;
  if (typeof url !== "string" || typeof tag !== "string" || tag === "") return null;
  return { title, body, url, tag };
}

/** `url` as a full URL when it is inside the app; the app's root for anything else. */
function appUrl(url) {
  if (typeof url === "string") {
    try {
      const target = new URL(url, scope());
      if (target.href.startsWith(scope())) return target.href;
    } catch {
      // Not a URL: the root below.
    }
  }
  return scope();
}

function show(payload) {
  const icon = new URL("icons/icon-192.png", scope()).href;
  if (payload === null) {
    // Not one of ours (a test push from the browser's tools, say). Show something
    // anyway: a push that shows nothing counts against the site in Chrome and Safari.
    return self.registration.showNotification("Almanac", { icon, tag: "almanac", data: { url: scope() } });
  }
  return self.registration.showNotification(payload.title, {
    body: payload.body,
    icon,
    tag: payload.tag,
    data: { url: appUrl(payload.url) },
  });
}

/**
 * Focus an Almanac window and take it to `url`, or open one there. The window
 * already on `url` wins, then the one in front, then any.
 */
async function open(url) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const inApp = windows.filter((client) => client.url.startsWith(scope()));
  const target = inApp.find((client) => client.url === url) || inApp.find((client) => client.focused) || inApp[0];
  if (target) {
    let focused = target;
    try {
      focused = (await target.focus()) || target;
    } catch {
      // Focus can be refused; the window is still there to move.
    }
    if (focused.url === url) return;
    try {
      await focused.navigate(url);
      return;
    } catch {
      // Only a window this worker controls can be navigated from here. The app
      // listens for this and moves itself (web/src/push/subscription.ts).
      focused.postMessage({ type: "almanac:open", url });
      return;
    }
  }
  await self.clients.openWindow(url);
}

// Nothing to set up and nothing cached, so a new worker takes over at once.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(show(readPayload(event.data)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data;
  event.waitUntil(open(appUrl(data && data.url)));
});
