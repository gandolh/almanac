import type { Calendar, Occurrence } from "@almanac/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Temporal, visibleRange } from "../dates";
import { DayList, type DayListProps } from "./DayList";
import { YearView } from "./YearView";
import { coveredSpan, isOnDay, markedDays, occurrencesOn, shownOccurrences, timeLabel } from "./days";

const BUCHAREST = "Europe/Bucharest";

function calendar(id: number, extra: Partial<Calendar> = {}): Calendar {
  return {
    id,
    name: `Calendar ${id}`,
    color: "blue",
    visible: true,
    position: id,
    createdAt: "2026-10-16T09:00:00Z",
    updatedAt: "2026-10-16T09:00:00Z",
    ...extra,
  };
}

function occurrence(id: string, extra: Partial<Occurrence> = {}): Occurrence {
  return {
    id,
    eventId: 1,
    seriesId: null,
    originalStart: null,
    calendarId: 1,
    title: "Standup",
    location: "",
    notes: "",
    allDay: false,
    start: "2026-10-16T07:00:00Z",
    end: "2026-10-16T07:30:00Z",
    repeat: null,
    ...extra,
  };
}

/** An all-day occurrence; `end` is the day after the last day. */
function allDay(id: string, start: string, end: string, extra: Partial<Occurrence> = {}): Occurrence {
  return occurrence(id, { allDay: true, start, end, ...extra });
}

const work = calendar(1, { color: "teal" });
const gym = calendar(2, { color: "yellow" });
const hidden = calendar(3, { visible: false });
const year2026 = visibleRange("year", Temporal.PlainDate.from("2026-06-01"));

function marked(occurrences: Occurrence[], calendars: Calendar[] = [work], timeZone = BUCHAREST): string[] {
  return [...markedDays(occurrences, calendars, timeZone, year2026)].sort();
}

describe("coveredSpan", () => {
  it("puts a timed occurrence on the display time zone's days, not UTC's", () => {
    // 21:30 UTC is 00:30 the next day in Bucharest (UTC+3 in October).
    const late = { allDay: false, start: "2026-10-16T21:30:00Z", end: "2026-10-16T22:30:00Z" };
    expect(coveredSpan(late, BUCHAREST)).toEqual({ first: Temporal.PlainDate.from("2026-10-17"), last: Temporal.PlainDate.from("2026-10-17") });
    expect(coveredSpan(late, "UTC")).toEqual({ first: Temporal.PlainDate.from("2026-10-16"), last: Temporal.PlainDate.from("2026-10-16") });
  });

  it("ends a timed occurrence the minute before its exclusive end", () => {
    // 22:00 to 00:00 local: the day that starts at the end isn't reached.
    const toMidnight = { allDay: false, start: "2026-10-16T19:00:00Z", end: "2026-10-16T21:00:00Z" };
    expect(coveredSpan(toMidnight, BUCHAREST).last.toString()).toBe("2026-10-16");
    // 23:00 to 02:00: both.
    const overnight = { allDay: false, start: "2026-10-16T20:00:00Z", end: "2026-10-16T23:00:00Z" };
    expect(coveredSpan(overnight, BUCHAREST)).toEqual({ first: Temporal.PlainDate.from("2026-10-16"), last: Temporal.PlainDate.from("2026-10-17") });
  });

  it("reads all-day dates as they are, the end exclusive", () => {
    expect(coveredSpan({ allDay: true, start: "2026-10-16", end: "2026-10-17" }, BUCHAREST)).toEqual({
      first: Temporal.PlainDate.from("2026-10-16"),
      last: Temporal.PlainDate.from("2026-10-16"),
    });
    expect(coveredSpan({ allDay: true, start: "2026-10-30", end: "2026-11-02" }, "Pacific/Auckland").last.toString()).toBe("2026-11-01");
  });

  it("is never empty, even for an end that is not after the start", () => {
    expect(coveredSpan({ allDay: true, start: "2026-10-16", end: "2026-10-16" }, BUCHAREST).last.toString()).toBe("2026-10-16");
    expect(coveredSpan({ allDay: false, start: "2026-10-16T07:00:00Z", end: "2026-10-16T07:00:00Z" }, BUCHAREST).last.toString()).toBe("2026-10-16");
  });

  it("keeps a day that is 25 hours long (the clocks go back on 25 October) as one day", () => {
    const wholeDay = { allDay: false, start: "2026-10-24T21:00:00Z", end: "2026-10-25T22:00:00Z" };
    expect(coveredSpan(wholeDay, BUCHAREST)).toEqual({ first: Temporal.PlainDate.from("2026-10-25"), last: Temporal.PlainDate.from("2026-10-25") });
  });
});

describe("isOnDay", () => {
  const trip = allDay("e1", "2026-10-30", "2026-11-02");
  it("holds for every day from the first to the last, and no other", () => {
    const on = (date: string) => isOnDay(trip, Temporal.PlainDate.from(date), BUCHAREST);
    expect([on("2026-10-29"), on("2026-10-30"), on("2026-10-31"), on("2026-11-01"), on("2026-11-02")]).toEqual([false, true, true, true, false]);
  });
});

describe("shownOccurrences", () => {
  it("keeps the occurrences of visible calendars the list knows, as the month view does", () => {
    const all = [
      occurrence("e1", { calendarId: 1 }),
      occurrence("e2", { calendarId: 3 }),
      occurrence("e3", { calendarId: 99 }),
    ];
    expect(shownOccurrences(all, [work, hidden]).map((each) => each.id)).toEqual(["e1"]);
    expect(shownOccurrences(all, [])).toEqual([]);
  });
});

describe("markedDays", () => {
  it("marks the day of a timed occurrence", () => {
    expect(marked([occurrence("e1")])).toEqual(["2026-10-16"]);
  });

  it("marks the day it is on in the display time zone", () => {
    const late = occurrence("e1", { start: "2026-10-16T21:30:00Z", end: "2026-10-16T22:30:00Z" });
    expect(marked([late])).toEqual(["2026-10-17"]);
    expect(marked([late], [work], "UTC")).toEqual(["2026-10-16"]);
  });

  it("marks both days of one that runs past midnight, but not the day an event ends at", () => {
    const overnight = occurrence("e1", { start: "2026-10-16T20:00:00Z", end: "2026-10-16T23:00:00Z" });
    const toMidnight = occurrence("e2", { start: "2026-10-18T19:00:00Z", end: "2026-10-18T21:00:00Z" });
    expect(marked([overnight, toMidnight])).toEqual(["2026-10-16", "2026-10-17", "2026-10-18"]);
  });

  it("marks an all-day occurrence's day", () => {
    expect(marked([allDay("e1", "2026-10-16", "2026-10-17")])).toEqual(["2026-10-16"]);
  });

  it("marks every day of a multi-day event, across a month, and not the exclusive end", () => {
    expect(marked([allDay("e1", "2026-10-30", "2026-11-02")])).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("marks only the days inside the year", () => {
    const newYear = allDay("e1", "2026-12-30", "2027-01-03");
    const lastYears = allDay("e2", "2025-12-30", "2026-01-02");
    expect(marked([newYear, lastYears])).toEqual(["2026-01-01", "2026-12-30", "2026-12-31"]);
  });

  it("ignores occurrences on hidden calendars and on calendars it doesn't know", () => {
    const events = [
      occurrence("e1", { calendarId: 1 }),
      occurrence("e2", { calendarId: 3, start: "2026-10-20T07:00:00Z", end: "2026-10-20T08:00:00Z" }),
      occurrence("e3", { calendarId: 99, start: "2026-10-21T07:00:00Z", end: "2026-10-21T08:00:00Z" }),
    ];
    expect(marked(events, [work, hidden])).toEqual(["2026-10-16"]);
    expect(marked(events, [])).toEqual([]);
  });

  it("marks a day once however many events it has", () => {
    expect(marked([occurrence("e1"), occurrence("e2", { calendarId: 2 }), allDay("e3", "2026-10-16", "2026-10-17")], [work, gym])).toEqual(["2026-10-16"]);
  });
});

describe("occurrencesOn", () => {
  const day = Temporal.PlainDate.from("2026-10-16");
  const calendars = [work, gym, hidden];

  it("lists the day's events in start order, all-day first", () => {
    const events = [
      occurrence("e1", { title: "Lunch", start: "2026-10-16T09:00:00Z", end: "2026-10-16T10:00:00Z" }),
      occurrence("e2", { title: "Standup", start: "2026-10-16T07:00:00Z", end: "2026-10-16T07:30:00Z" }),
      allDay("e3", "2026-10-16", "2026-10-17", { title: "Holiday" }),
      occurrence("e4", { title: "Dinner", calendarId: 2, start: "2026-10-16T16:00:00Z", end: "2026-10-16T18:00:00Z" }),
    ];
    expect(occurrencesOn(day, events, calendars, BUCHAREST).map((each) => each.title)).toEqual(["Holiday", "Standup", "Lunch", "Dinner"]);
  });

  it("includes a multi-day event on each of its days, and leaves out other days and hidden calendars", () => {
    const events = [
      allDay("e1", "2026-10-14", "2026-10-18", { title: "Conference" }),
      allDay("e2", "2026-10-17", "2026-10-18", { title: "Tomorrow" }),
      occurrence("e3", { title: "Secret", calendarId: 3 }),
      occurrence("e4", { title: "Standup" }),
    ];
    expect(occurrencesOn(day, events, calendars, BUCHAREST).map((each) => each.title)).toEqual(["Conference", "Standup"]);
  });

  it("decides the day in the display time zone", () => {
    const late = occurrence("e1", { start: "2026-10-16T21:30:00Z", end: "2026-10-16T22:30:00Z" });
    expect(occurrencesOn(day, [late], calendars, BUCHAREST)).toEqual([]);
    expect(occurrencesOn(Temporal.PlainDate.from("2026-10-17"), [late], calendars, BUCHAREST)).toEqual([late]);
  });

  it("is empty for a day with nothing", () => {
    expect(occurrencesOn(day, [], calendars, BUCHAREST)).toEqual([]);
  });
});

describe("timeLabel", () => {
  it("is 'All day', or the start on the display time zone's 24-hour clock", () => {
    expect(timeLabel(allDay("e1", "2026-10-16", "2026-10-17"), BUCHAREST)).toBe("All day");
    expect(timeLabel(occurrence("e2", { start: "2026-10-16T07:00:00Z" }), BUCHAREST)).toBe("10:00");
    expect(timeLabel(occurrence("e3", { start: "2026-10-16T07:05:00Z" }), "UTC")).toBe("07:05");
    expect(timeLabel(occurrence("e4", { start: "2026-10-16T12:30:00Z" }), "UTC")).toBe("12:30");
    expect(timeLabel(occurrence("e5", { start: "2026-10-16T21:30:00Z" }), BUCHAREST)).toBe("00:30");
  });
});

describe("DayList", () => {
  const day = Temporal.PlainDate.from("2026-10-16");

  beforeEach(() => {
    vi.stubEnv("BASE_URL", "/almanac/");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function list(occurrences: Occurrence[], props: Partial<DayListProps> = {}): string {
    return renderToStaticMarkup(
      createElement(DayList, {
        date: day,
        occurrences,
        calendars: [work, gym, hidden],
        timeZone: BUCHAREST,
        titleId: "day-title",
        onOpenDay: () => undefined,
        ...props,
      }),
    );
  }

  /** The `time` and `name` text of each row, in order. */
  function rows(html: string): string[] {
    return [...html.matchAll(/day-list__time">([^<]*)<\/span><span class="day-list__name">([^<]*)</g)].map((m) => `${m[1]} ${m[2]}`);
  }

  it("heads the list with the day, and names the popover by it", () => {
    const html = list([]);
    expect(html).toContain('<h2 id="day-title" class="day-list__title">Friday, 16 October</h2>');
  });

  it("says 'No events' for an empty day, and still offers the day", () => {
    const html = list([occurrence("e1", { calendarId: 3 })]);
    expect(html).toContain("No events");
    expect(html).not.toContain("day-list__event");
    expect(html).toContain('href="/almanac/day/2026/10/16"');
    expect(html).toContain(">Open day</a>");
  });

  it("lists the events in start order with 'All day' or the 24-hour time", () => {
    const html = list([
      occurrence("e1", { title: "Lunch", start: "2026-10-16T09:00:00Z", end: "2026-10-16T10:00:00Z" }),
      occurrence("e2", { title: "Standup" }),
      allDay("e3", "2026-10-16", "2026-10-17", { title: "Holiday" }),
    ]);
    expect(rows(html)).toEqual(["All day Holiday", "10:00 Standup", "12:00 Lunch"]);
    expect(html).not.toContain("No events");
  });

  it("gives each event its calendar's colour and an empty title the views' placeholder", () => {
    const html = list([
      occurrence("e1", { title: "  ", calendarId: 1 }),
      occurrence("e2", { title: "Dinner", calendarId: 2, start: "2026-10-16T16:00:00Z", end: "2026-10-16T17:00:00Z" }),
    ]);
    expect(html).toContain("--calendar-color:#009688");
    expect(html).toContain("--calendar-color:#F6BF26");
    expect(rows(html)).toEqual(["10:00 (No title)", "19:00 Dinner"]);
  });

  it("escapes a title", () => {
    expect(rows(list([occurrence("e1", { title: "<b>Hi</b>" })]))).toEqual(["10:00 &lt;b&gt;Hi&lt;/b&gt;"]);
  });
});

describe("YearView", () => {
  // Before anything is fetched: the twelve months, in order, each name a button that labels its grid.
  const html = renderToStaticMarkup(createElement(YearView, { year: 2026, onOpenDay: () => undefined, onOpenMonth: () => undefined }));

  it("draws the twelve months, named by buttons, in the year's order", () => {
    const names = [...html.matchAll(/<button[^>]*class="year-month__title"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
    expect(names).toEqual(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
    expect(html).toContain('aria-label="Year view"');
    expect(html.match(/<table[^>]*aria-labelledby=/g)).toHaveLength(12);
  });

  it("draws no day twice: the cells outside a month are empty", () => {
    const keys = [...html.matchAll(/data-date="([^"]+)"/g)].map((m) => m[1]);
    expect(keys).toHaveLength(365);
    expect(new Set(keys).size).toBe(365);
  });
});
