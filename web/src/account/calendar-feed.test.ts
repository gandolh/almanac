import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarFeedPanel, FEED_MESSAGES, sinceText, type CalendarFeedPanelProps } from "./CalendarFeed";

// Base UI's dialog portal needs a DOM; this renders the dialog in place.
vi.mock("@base-ui/react/dialog", () => import("../components/ui/dialog-stub"));

const LINK = "http://localhost:5177/almanac-api/api/feed/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/almanac.ics";

const panel = (props: Omit<CalendarFeedPanelProps, "timeZone">) =>
  renderToStaticMarkup(createElement(CalendarFeedPanel, { timeZone: "Europe/Bucharest", ...props }));

/** The markup's text, tags dropped and entities as they read. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

describe("the Calendar feed dialog", () => {
  it("says it is checking, or that it couldn't and offers another try, with no switch", () => {
    expect(text(panel({ view: { kind: "loading" } }))).toContain(FEED_MESSAGES.loading);
    const failed = panel({ view: { kind: "check-failed" } });
    expect(text(failed)).toContain(FEED_MESSAGES["check-failed"]);
    expect(text(failed)).toContain("Try again");
    expect(failed).not.toContain('role="switch"');
  });

  it("is a switch, off, with no link and no New link, until it is on", () => {
    const html = panel({ view: { kind: "ready", on: false, createdAt: null, link: null } });
    expect(html).toContain('role="switch"');
    expect(html).not.toContain('aria-checked="true"');
    expect(text(html)).toContain(FEED_MESSAGES.off);
    expect(text(html)).not.toContain("New link");
    expect(html).not.toContain("almanac.ics");
  });

  it("shows the link just made once, read-only, with Copy link and how to add it on Android", () => {
    const html = panel({ view: { kind: "ready", on: true, createdAt: "2026-11-13T21:30:00.000Z", link: LINK } });
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain(`value="${LINK}"`);
    expect(html).toContain("readOnly");
    expect(text(html)).toContain("Copy link");
    expect(text(html)).toContain(FEED_MESSAGES.shownOnce);
    expect(text(html)).toContain("ICSx⁵");
    expect(text(html)).toContain("New link");
  });

  it("says the link can't be shown again once it has been", () => {
    const html = panel({ view: { kind: "ready", on: true, createdAt: "2026-11-13T21:30:00.000Z", link: null } });
    expect(html).not.toContain("almanac.ics");
    expect(text(html)).toContain(FEED_MESSAGES.lost);
    expect(text(html)).toContain("New link");
  });

  it("calls them reminders, never alarms", () => {
    for (const message of Object.values(FEED_MESSAGES)) expect(message.toLowerCase()).not.toContain("alarm");
  });
});

describe("sinceText", () => {
  it("dates the link in the display time zone", () => {
    // 22:30 UTC on the 13th is already 00:30 on the 14th in Bucharest (UTC+2 in November).
    expect(sinceText("2026-11-13T22:30:00.000Z", "Europe/Bucharest")).toBe("On since 14 Nov 2026.");
    expect(sinceText("2026-11-13T22:30:00.000Z", "UTC")).toBe("On since 13 Nov 2026.");
    expect(sinceText(null, "UTC")).toBe("On.");
  });
});
