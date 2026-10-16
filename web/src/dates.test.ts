import { describe, expect, it } from "vitest";
import {
  Temporal,
  dateFrom,
  dateKey,
  datesOf,
  formatDate,
  formatDayFull,
  formatDayLong,
  formatTime,
  instantRange,
  isView,
  monthTitle,
  monthWeeks,
  parseDateKey,
  rangeTitle,
  rangeTitleShort,
  sameDate,
  startOfWeek,
  stepDate,
  todayIn,
  visibleRange,
  wireInstant,
  zonedOf,
  type View,
} from "./dates";

const date = (text: string) => Temporal.PlainDate.from(text);
const span = (view: View, at: string) => {
  const { start, end } = visibleRange(view, date(at));
  return [start.toString(), end.toString()];
};

describe("today", () => {
  it("is the date in the display time zone, not the device's", () => {
    // 22:30 UTC on 15 October is already the 16th in Bucharest and still the 15th in New York.
    const now = Temporal.Instant.from("2026-10-15T22:30:00Z");
    expect(todayIn("Europe/Bucharest", now).toString()).toBe("2026-10-16");
    expect(todayIn("UTC", now).toString()).toBe("2026-10-15");
    expect(todayIn("America/New_York", now).toString()).toBe("2026-10-15");
    expect(todayIn("Pacific/Kiritimati", Temporal.Instant.from("2026-12-31T10:00:00Z")).toString()).toBe("2027-01-01");
  });

  it("defaults to now", () => {
    expect(todayIn("UTC")).toBeInstanceOf(Temporal.PlainDate);
  });
});

describe("weeks start on Monday", () => {
  it("finds the Monday on or before a date", () => {
    expect(startOfWeek(date("2026-10-16")).toString()).toBe("2026-10-12"); // a Friday
    expect(startOfWeek(date("2026-10-12")).toString()).toBe("2026-10-12"); // a Monday
    expect(startOfWeek(date("2026-10-18")).toString()).toBe("2026-10-12"); // a Sunday
    expect(startOfWeek(date("2026-01-01")).toString()).toBe("2025-12-29"); // across a year
  });
});

describe("visibleRange", () => {
  it("is one day for the day view", () => {
    expect(span("day", "2026-10-16")).toEqual(["2026-10-16", "2026-10-17"]);
    expect(span("day", "2026-12-31")).toEqual(["2026-12-31", "2027-01-01"]);
  });

  it("is Monday to Sunday for the week view", () => {
    expect(span("week", "2026-10-16")).toEqual(["2026-10-12", "2026-10-19"]);
    expect(span("week", "2026-10-18")).toEqual(["2026-10-12", "2026-10-19"]);
    expect(span("week", "2026-10-19")).toEqual(["2026-10-19", "2026-10-26"]);
  });

  it("is the whole weeks holding the month for the month view", () => {
    // October 2026: Thursday the 1st to Saturday the 31st.
    expect(span("month", "2026-10-16")).toEqual(["2026-09-28", "2026-11-02"]);
    // February 2027 starts on a Monday and ends on a Sunday: exactly four weeks.
    expect(span("month", "2027-02-10")).toEqual(["2027-02-01", "2027-03-01"]);
    // March 2026 starts on a Sunday: six weeks.
    expect(span("month", "2026-03-31")).toEqual(["2026-02-23", "2026-04-06"]);
  });

  it("is 1 January to 1 January for the year view", () => {
    expect(span("year", "2026-10-16")).toEqual(["2026-01-01", "2027-01-01"]);
    expect(span("year", "2028-02-29")).toEqual(["2028-01-01", "2029-01-01"]);
  });

  it("lists the dates of a span, the end left out", () => {
    expect(datesOf(visibleRange("week", date("2026-10-16"))).map(String)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(datesOf({ start: date("2026-10-16"), end: date("2026-10-16") })).toEqual([]);
  });
});

describe("previous and next", () => {
  it("steps a day, a week, a month or a year", () => {
    expect(stepDate("day", date("2026-10-31"), 1).toString()).toBe("2026-11-01");
    expect(stepDate("day", date("2026-01-01"), -1).toString()).toBe("2025-12-31");
    expect(stepDate("week", date("2026-10-16"), 1).toString()).toBe("2026-10-23");
    expect(stepDate("week", date("2026-10-02"), -1).toString()).toBe("2026-09-25");
    expect(stepDate("month", date("2026-10-16"), 1).toString()).toBe("2026-11-16");
    expect(stepDate("month", date("2026-01-16"), -1).toString()).toBe("2025-12-16");
    expect(stepDate("year", date("2026-10-16"), 1).toString()).toBe("2027-10-16");
    expect(stepDate("year", date("2026-10-16"), -1).toString()).toBe("2025-10-16");
  });

  it("clamps a day the next month or year doesn't have", () => {
    expect(stepDate("month", date("2026-01-31"), 1).toString()).toBe("2026-02-28");
    expect(stepDate("month", date("2028-01-31"), 1).toString()).toBe("2028-02-29");
    expect(stepDate("month", date("2026-03-31"), -1).toString()).toBe("2026-02-28");
    expect(stepDate("month", date("2026-08-31"), 1).toString()).toBe("2026-09-30");
    expect(stepDate("year", date("2028-02-29"), 1).toString()).toBe("2029-02-28");
    expect(stepDate("month", date("2026-01-31"), 12).toString()).toBe("2027-01-31");
  });
});

describe("rangeTitleShort", () => {
  it("keeps the year in a form that fits a phone's bar", () => {
    expect(rangeTitleShort("day", date("2026-10-16"))).toBe("16 Oct 2026");
    expect(rangeTitleShort("week", date("2026-10-21"))).toBe("19–25 Oct 2026");
    expect(rangeTitleShort("week", date("2026-10-28"))).toBe("Oct–Nov 2026");
    expect(rangeTitleShort("week", date("2026-12-31"))).toBe("Dec ’26–Jan ’27");
    expect(rangeTitleShort("month", date("2026-10-16"))).toBe("Oct 2026");
    expect(rangeTitleShort("year", date("2026-10-16"))).toBe("2026");
  });
});

describe("rangeTitle", () => {
  it("writes each view's title as Google does", () => {
    expect(rangeTitle("day", date("2026-10-16"))).toBe("16 October 2026");
    expect(rangeTitle("week", date("2026-10-21"))).toBe("19 – 25 Oct 2026");
    expect(rangeTitle("month", date("2026-10-16"))).toBe("October 2026");
    expect(rangeTitle("year", date("2026-10-16"))).toBe("2026");
  });

  it("names both months for a week across two, and both years across a new year", () => {
    expect(rangeTitle("week", date("2026-10-28"))).toBe("Oct – Nov 2026");
    expect(rangeTitle("week", date("2026-12-31"))).toBe("Dec 2026 – Jan 2027");
    expect(rangeTitle("week", date("2026-09-30"))).toBe("Sep – Oct 2026");
  });

  it("writes a month or year-month title", () => {
    expect(monthTitle(Temporal.PlainYearMonth.from("2027-01"))).toBe("January 2027");
    expect(monthTitle(date("2026-05-01"))).toBe("May 2026");
  });
});

describe("formatting", () => {
  it("writes times on a 24-hour clock", () => {
    expect(formatTime(Temporal.PlainTime.from("14:30"))).toBe("14:30");
    expect(formatTime(Temporal.PlainTime.from("09:05"))).toBe("09:05");
    expect(formatTime(Temporal.PlainTime.from("00:00"))).toBe("00:00");
    expect(formatTime(Temporal.PlainDateTime.from("2026-10-16T23:59:59"))).toBe("23:59");
    expect(formatTime(zonedOf("2026-10-16T07:00:00Z", "Europe/Bucharest"))).toBe("10:00");
    expect(formatTime(zonedOf("2026-10-16T07:00:00Z", "Europe/London"))).toBe("08:00");
  });

  it("writes dates as 16 Oct 2026 and day headings as Friday, 16 October", () => {
    expect(formatDate(date("2026-10-16"))).toBe("16 Oct 2026");
    expect(formatDate(date("2027-01-01"))).toBe("1 Jan 2027");
    expect(formatDate(date("2026-09-05"))).toBe("5 Sep 2026");
    expect(formatDayLong(date("2026-10-16"))).toBe("Friday, 16 October");
    expect(formatDayLong(date("2026-10-18"))).toBe("Sunday, 18 October");
    expect(formatDayLong(date("2026-10-12"))).toBe("Monday, 12 October");
    expect(formatDayFull(date("2026-10-16"))).toBe("Friday, 16 October 2026");
  });
});

describe("instants", () => {
  it("turns a span of days into the instants of local midnights", () => {
    expect(instantRange(visibleRange("day", date("2026-10-16")), "Europe/Bucharest")).toEqual({
      from: "2026-10-15T21:00:00Z",
      to: "2026-10-16T21:00:00Z",
    });
    // The year view's range, across the switch to summer time and back.
    expect(instantRange(visibleRange("year", date("2026-10-16")), "Europe/Bucharest")).toEqual({
      from: "2025-12-31T22:00:00Z",
      to: "2026-12-31T22:00:00Z",
    });
    // The night summer time ends in Bucharest is 25 hours long.
    expect(instantRange(visibleRange("day", date("2026-10-25")), "Europe/Bucharest")).toEqual({
      from: "2026-10-24T21:00:00Z",
      to: "2026-10-25T22:00:00Z",
    });
  });

  it("writes instants in the wire's form", () => {
    expect(wireInstant(Temporal.Instant.from("2026-10-16T07:00:00.987Z"))).toBe("2026-10-16T07:00:00Z");
  });
});

describe("date keys", () => {
  it("writes and reads YYYY-MM-DD", () => {
    expect(dateKey(date("2026-01-05"))).toBe("2026-01-05");
    expect(parseDateKey("2026-01-05")?.toString()).toBe("2026-01-05");
    expect(parseDateKey("2028-02-29")?.toString()).toBe("2028-02-29");
  });

  it("refuses dates that don't exist and other shapes", () => {
    for (const key of ["2026-02-29", "2026-13-01", "2026-00-10", "2026-1-5", "0000-01-01", "16 Oct 2026", ""]) {
      expect(parseDateKey(key), key).toBeNull();
    }
    expect(dateFrom(2026, 2, 30)).toBeNull();
    expect(dateFrom(10000, 1, 1)).toBeNull();
    expect(dateFrom(2026, 1.5, 1)).toBeNull();
  });

  it("compares dates", () => {
    expect(sameDate(date("2026-10-16"), Temporal.PlainDate.from({ year: 2026, month: 10, day: 16 }))).toBe(true);
    expect(sameDate(date("2026-10-16"), date("2026-10-17"))).toBe(false);
  });
});

describe("monthWeeks", () => {
  it("draws six Monday-first weeks from the week of the 1st", () => {
    const weeks = monthWeeks(Temporal.PlainYearMonth.from("2026-10"));
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7 && week[0]?.dayOfWeek === 1)).toBe(true);
    expect(weeks[0]?.[0]?.toString()).toBe("2026-09-28");
    expect(weeks[0]?.[3]?.toString()).toBe("2026-10-01");
    expect(weeks[5]?.[6]?.toString()).toBe("2026-11-08");
  });

  it("starts on the 1st when the month starts on a Monday", () => {
    expect(monthWeeks(Temporal.PlainYearMonth.from("2027-02"))[0]?.[0]?.toString()).toBe("2027-02-01");
  });
});

describe("views", () => {
  it("knows the four", () => {
    expect(["day", "week", "month", "year"].every(isView)).toBe(true);
    expect(isView("schedule")).toBe(false);
  });
});
