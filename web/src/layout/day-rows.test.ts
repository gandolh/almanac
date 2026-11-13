import type { Occurrence } from "@almanac/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DayRows, rowTime } from "./DayRows";

const ZONE = "Europe/Bucharest";

function occurrence(
  id: string,
  title: string,
  start: string,
  end: string,
  extra: Partial<Occurrence> = {},
): Occurrence {
  return {
    id,
    eventId: 1,
    seriesId: null,
    originalStart: null,
    calendarId: 1,
    title,
    location: "",
    notes: "",
    allDay: false,
    start,
    end,
    repeat: null,
    reminderMinutes: null,
    ...extra,
  };
}

// 07:00, 09:30 and 11:00 in Bucharest (UTC+2 on 11 November).
const RUN = occurrence("a", "Run", "2026-11-11T05:00:00Z", "2026-11-11T05:45:00Z");
const STANDUP = occurrence("b", "Team standup", "2026-11-11T07:30:00Z", "2026-11-11T08:00:00Z");
const REVIEW = occurrence("c", "Design review", "2026-11-11T09:00:00Z", "2026-11-11T10:00:00Z", { location: "Room 2" });

function rows(now: string | null, list: Occurrence[] = [RUN, STANDUP, REVIEW]): string {
  return renderToStaticMarkup(
    createElement(DayRows, { occurrences: list, calendars: [], timeZone: ZONE, now, onOpen: () => undefined }),
  );
}

describe("rowTime", () => {
  it("writes the range on the display zone's clock, or All day", () => {
    expect(rowTime(RUN, ZONE)).toBe("07:00 – 07:45");
    expect(rowTime({ allDay: true, start: "2026-11-12", end: "2026-11-13" }, ZONE)).toBe("All day");
  });
});

describe("DayRows", () => {
  it("puts the now rule between the rows the clock is between", () => {
    const html = rows("10:30");
    expect(html.indexOf("Team standup")).toBeLessThan(html.indexOf('aria-label="Now, 10:30"'));
    expect(html.indexOf('aria-label="Now, 10:30"')).toBeLessThan(html.indexOf("Design review"));
  });

  it("puts it last when every row has started, and leaves it out on another day", () => {
    const html = rows("12:00");
    expect(html.indexOf("Design review")).toBeLessThan(html.indexOf('aria-label="Now, 12:00"'));
    expect(rows(null)).not.toContain("Now,");
  });

  it("shows the place under the title", () => {
    expect(rows(null)).toMatch(/Design review<\/span><span[^>]*>.*Room 2/);
  });
});
