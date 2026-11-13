import { describe, expect, it } from "vitest";
import { LOG_REDACT, redactFeedToken } from "./log.js";

describe("redactFeedToken", () => {
  it("replaces a feed link's token and leaves every other URL as it was", () => {
    expect(redactFeedToken("/api/feed/abcDEF123_-xyz/almanac.ics")).toBe("/api/feed/<token>/almanac.ics");
    expect(redactFeedToken("/api/feed/abcDEF123_-xyz/almanac.ics?x=1")).toBe("/api/feed/<token>/almanac.ics?x=1");
    expect(redactFeedToken("/api/feed/abcDEF123_-xyz")).toBe("/api/feed/<token>");
    expect(redactFeedToken("/api/feed")).toBe("/api/feed");
    expect(redactFeedToken("/api/occurrences?from=2026-11-01")).toBe("/api/occurrences?from=2026-11-01");
    expect(LOG_REDACT.censor(42)).toBe(42);
  });
});
