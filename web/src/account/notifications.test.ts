import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MESSAGES, NotificationsDialog, NotificationsPanel, blockedHelp, type NotificationsPanelProps, type NotificationsView } from "./Notifications";

// Base UI's dialog portal needs a DOM; this renders the dialog in place.
vi.mock("@base-ui/react/dialog", () => import("../components/dialog-stub"));

const panel = (props: NotificationsPanelProps) => renderToStaticMarkup(createElement(NotificationsPanel, props));
const ready = (over: Partial<Extract<NotificationsView, { kind: "ready" }>> = {}): NotificationsView => ({
  kind: "ready",
  on: false,
  permission: "default",
  publicKey: "key",
  ios: false,
  ...over,
});

/** The markup's text, tags dropped and entities as they read. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("the Notifications dialog", () => {
  it.each([
    ["loading", MESSAGES.loading],
    ["unsupported", MESSAGES.unsupported],
    ["server-off", "Notifications aren't set up on this server."],
    ["ios-home-screen", "Add to Home Screen"],
    ["ios-update", "iOS 16.4"],
    ["check-failed", MESSAGES["check-failed"]],
  ] as const)("says why it can't in the %s state, with no switch", (kind, words) => {
    const html = panel({ view: { kind } });
    expect(text(html)).toContain(words);
    expect(html).not.toContain('role="switch"');
  });

  it("offers another try when the check failed", () => {
    expect(text(panel({ view: { kind: "check-failed" } }))).toContain("Try again");
  });

  it("is a switch, off, with no test, until it is on", () => {
    const html = panel({ view: ready() });
    expect(html).toContain('role="switch"');
    expect(html).not.toContain('aria-checked="true"');
    expect(text(html)).toContain(MESSAGES.off);
    expect(text(html)).not.toContain("Send a test");
  });

  it("is on, with the test, once on", () => {
    const html = panel({ view: ready({ on: true, permission: "granted" }) });
    expect(html).toContain('aria-checked="true"');
    expect(text(html)).toContain(MESSAGES.on);
    expect(text(html)).toContain("Send a test");
  });

  it("says where to lift a block, on a computer and on an iPhone, and won't switch", () => {
    const html = panel({ view: ready({ permission: "denied" }) });
    expect(text(html)).toContain("Blocked in this browser.");
    expect(text(html)).toContain(blockedHelp(false));
    expect(html).toContain("data-disabled");
    expect(text(panel({ view: ready({ permission: "denied", ios: true }) }))).toContain("iPhone's Settings");
  });

  it("shows a failure as an alert and a note as a status", () => {
    const html = panel({ view: ready({ on: true, permission: "granted" }), error: "Couldn't send the test. Try again.", note: "Sent." });
    expect(html).toMatch(/role="alert"[^>]*>Couldn&#x27;t send the test/);
    expect(html).toMatch(/role="status"[^>]*>Sent\./);
  });

  it("renders nothing of itself while closed, and starts by checking when open", () => {
    expect(renderToStaticMarkup(createElement(NotificationsDialog, { open: false, onClose: () => undefined }))).toBe("");
    const open = renderToStaticMarkup(createElement(NotificationsDialog, { open: true, onClose: () => undefined }));
    expect(text(open)).toContain("Notifications");
    expect(text(open)).toContain(MESSAGES.loading);
    expect(text(open)).toContain("Done");
  });
});
