import { allDayRange, repeatToRRule, type Repeat } from "@almanac/shared";
import { describe, expect, it } from "vitest";
import type { EventRange, EventRecord } from "../store/events.js";
import {
  MAX_OCCURRENCES_PER_SERIES,
  countBefore,
  expandSeries,
  isGenerated,
  nextKey,
  occurrenceEnd,
  previousKey,
  searchOccurrence,
  snapToFirst,
  type SeriesRecord,
} from "./expand.js";

const ZONE = "Europe/Bucharest";

/** A stored series as the store would give it back, `repeat` turned into its rule from `start`. */
function series(start: string, end: string, repeat: Repeat, fields: Partial<EventRecord> = {}): SeriesRecord {
  const allDay = !start.includes("T");
  const tzid = fields.tzid ?? ZONE;
  return {
    id: 7,
    calendarId: 1,
    title: "Standup",
    location: "",
    notes: "",
    allDay,
    start,
    end,
    tzid,
    rrule: repeatToRRule(repeat, start, tzid),
    exdates: [],
    seriesId: null,
    originalStart: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...fields,
  } as SeriesRecord;
}

function range(fromIso: string, toIso: string, zone = ZONE): EventRange {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return { from, to, dates: allDayRange(from, to, zone) };
}

/** October 2026 in Bucharest. */
const OCTOBER = range("2026-10-01T00:00:00+03:00", "2026-11-01T00:00:00+02:00");
const never = { type: "never" } as const;
const starts = (list: { start: string }[]) => list.map((occurrence) => occurrence.start);

function exception(originalStart: string, start: string, end: string): EventRecord {
  return {
    ...series(start, end, { freq: "daily", end: never }),
    id: 99,
    rrule: null,
    seriesId: 7,
    originalStart,
  };
}

describe("expandSeries: each preset over a month", () => {
  it("daily: every day, 10:00 local on both sides of the change of time", () => {
    const daily = series("2026-10-01T07:00:00Z", "2026-10-01T07:30:00Z", { freq: "daily", end: never });
    const found = expandSeries(daily, [], OCTOBER);
    expect(found).toHaveLength(31);
    expect(found[0]).toEqual({
      id: "s7:2026-10-01T07:00:00Z",
      eventId: 7,
      seriesId: 7,
      originalStart: "2026-10-01T07:00:00Z",
      calendarId: 1,
      title: "Standup",
      location: "",
      notes: "",
      allDay: false,
      start: "2026-10-01T07:00:00Z",
      end: "2026-10-01T07:30:00Z",
      repeat: { freq: "daily", end: never },
    });
    expect(starts(found).slice(23, 26)).toEqual(["2026-10-24T07:00:00Z", "2026-10-25T08:00:00Z", "2026-10-26T08:00:00Z"]);
    expect(found[30]).toMatchObject({ start: "2026-10-31T08:00:00Z", end: "2026-10-31T08:30:00Z" });
  });

  it("every weekday: Monday to Friday", () => {
    const found = expandSeries(series("2026-10-01T06:00:00Z", "2026-10-01T07:00:00Z", { freq: "weekdays", end: never }), [], OCTOBER);
    expect(found).toHaveLength(22);
    expect(starts(found).slice(0, 4)).toEqual([
      "2026-10-01T06:00:00Z",
      "2026-10-02T06:00:00Z",
      "2026-10-05T06:00:00Z",
      "2026-10-06T06:00:00Z",
    ]);
    expect(found[0]?.repeat).toEqual({ freq: "weekdays", end: never });
  });

  it("weekly on chosen days", () => {
    const weekly = series("2026-10-05T07:00:00Z", "2026-10-05T08:00:00Z", { freq: "weekly", byDay: ["MO", "WE"], end: never });
    expect(starts(expandSeries(weekly, [], OCTOBER))).toEqual([
      "2026-10-05T07:00:00Z",
      "2026-10-07T07:00:00Z",
      "2026-10-12T07:00:00Z",
      "2026-10-14T07:00:00Z",
      "2026-10-19T07:00:00Z",
      "2026-10-21T07:00:00Z",
      "2026-10-26T08:00:00Z",
      "2026-10-28T08:00:00Z",
    ]);
  });

  it("monthly on the start's day, and yearly on its date", () => {
    const monthly = series("2026-08-16T07:00:00Z", "2026-08-16T08:00:00Z", { freq: "monthly", end: never });
    expect(starts(expandSeries(monthly, [], OCTOBER))).toEqual(["2026-10-16T07:00:00Z"]);
    const yearly = series("2020-10-16", "2020-10-17", { freq: "yearly", end: never });
    expect(expandSeries(yearly, [], OCTOBER)).toMatchObject([{ id: "s7:2026-10-16", start: "2026-10-16", end: "2026-10-17", allDay: true }]);
  });

  it("monthly on the 31st skips the shorter months; yearly on 29 February waits for a leap year", () => {
    const monthly = series("2026-01-31T08:00:00Z", "2026-01-31T09:00:00Z", { freq: "monthly", end: never });
    const year = range("2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z");
    expect(starts(expandSeries(monthly, [], year)).map((start) => start.slice(5, 10))).toEqual([
      "01-31",
      "03-31",
      "05-31",
      "07-31",
      "08-31",
      "10-31",
      "12-31",
    ]);
    const leap = series("2024-02-29", "2024-03-01", { freq: "yearly", end: never });
    expect(starts(expandSeries(leap, [], range("2025-01-01T00:00:00Z", "2026-01-01T00:00:00Z")))).toEqual([]);
    expect(starts(expandSeries(leap, [], range("2028-01-01T00:00:00Z", "2029-01-01T00:00:00Z")))).toEqual(["2028-02-29"]);
  });
});

describe("expandSeries: time zones", () => {
  it("keeps a weekly Monday 10:00 Bucharest meeting at 10:00 local across the end of summer time", () => {
    const weekly = series("2026-10-19T07:00:00Z", "2026-10-19T08:00:00Z", { freq: "weekly", end: never });
    expect(expandSeries(weekly, [], OCTOBER)).toMatchObject([
      { start: "2026-10-19T07:00:00Z", end: "2026-10-19T08:00:00Z" },
      { start: "2026-10-26T08:00:00Z", end: "2026-10-26T09:00:00Z" },
    ]);
  });

  it("keeps the length on the wall clock: a 23:00-08:00 night stays 23:00-08:00 when the clocks go back", () => {
    // 23:00 to 08:00 in Bucharest, nine hours on most nights and ten on 24-25 October.
    const night = series("2026-10-22T20:00:00Z", "2026-10-23T05:00:00Z", { freq: "daily", end: never });
    const found = expandSeries(night, [], range("2026-10-24T00:00:00+03:00", "2026-10-26T00:00:00+02:00"));
    expect(found.map(({ start, end }) => [start, end])).toEqual([
      ["2026-10-23T20:00:00Z", "2026-10-24T05:00:00Z"],
      ["2026-10-24T20:00:00Z", "2026-10-25T06:00:00Z"],
      ["2026-10-25T21:00:00Z", "2026-10-26T06:00:00Z"],
    ]);
  });

  it("follows the series' own zone, not the display zone", () => {
    // 10:00 in New York, which leaves summer time a week after Bucharest.
    const weekly = series("2026-10-19T14:00:00Z", "2026-10-19T15:00:00Z", { freq: "weekly", end: never }, { tzid: "America/New_York" });
    expect(starts(expandSeries(weekly, [], range("2026-10-19T00:00:00Z", "2026-11-10T00:00:00Z")))).toEqual([
      "2026-10-19T14:00:00Z",
      "2026-10-26T14:00:00Z",
      "2026-11-02T15:00:00Z",
      "2026-11-09T15:00:00Z",
    ]);
  });

  it("skips a time the clocks jump over, as RFC 5545 says", () => {
    // 03:30 does not happen in Bucharest on 29 March 2026.
    const early = series("2026-03-27T01:30:00Z", "2026-03-27T02:00:00Z", { freq: "daily", end: never });
    expect(starts(expandSeries(early, [], range("2026-03-27T00:00:00Z", "2026-03-31T00:00:00Z")))).toEqual([
      "2026-03-27T01:30:00Z",
      "2026-03-28T01:30:00Z",
      "2026-03-30T00:30:00Z",
    ]);
  });
});

describe("expandSeries: ends, deletions and exceptions", () => {
  it("ends after a date, every occurrence on that date included", () => {
    // 23:30 local is already the next day in UTC.
    const late = series("2026-10-16T20:30:00Z", "2026-10-16T21:00:00Z", { freq: "daily", end: { type: "until", date: "2026-10-20" } });
    const found = expandSeries(late, [], OCTOBER);
    expect(found).toHaveLength(5);
    expect(found[4]?.start).toBe("2026-10-20T20:30:00Z");
    expect(found[0]?.repeat).toEqual({ freq: "daily", end: { type: "until", date: "2026-10-20" } });
    const allDay = series("2026-10-16", "2026-10-17", { freq: "daily", end: { type: "until", date: "2026-10-20" } });
    expect(starts(expandSeries(allDay, [], OCTOBER))).toEqual(["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]);
  });

  it("ends after a count", () => {
    const three = series("2026-10-05T07:00:00Z", "2026-10-05T08:00:00Z", { freq: "weekly", end: { type: "count", count: 3 } });
    expect(starts(expandSeries(three, [], OCTOBER))).toEqual(["2026-10-05T07:00:00Z", "2026-10-12T07:00:00Z", "2026-10-19T07:00:00Z"]);
  });

  it("leaves out excluded dates, which still count towards the count", () => {
    const three = series("2026-10-05T07:00:00Z", "2026-10-05T08:00:00Z", { freq: "weekly", end: { type: "count", count: 3 } }, {
      exdates: ["2026-10-12T07:00:00Z"],
    });
    expect(starts(expandSeries(three, [], OCTOBER))).toEqual(["2026-10-05T07:00:00Z", "2026-10-19T07:00:00Z"]);
  });

  it("leaves out the occurrences exceptions replace, wherever the exception went", () => {
    const weekly = series("2026-10-05T07:00:00Z", "2026-10-05T08:00:00Z", { freq: "weekly", end: never });
    const movedOut = exception("2026-10-12T07:00:00Z", "2026-11-20T07:00:00Z", "2026-11-20T08:00:00Z");
    const movedIn = exception("2026-11-02T08:00:00Z", "2026-10-30T08:00:00Z", "2026-10-30T09:00:00Z");
    const found = expandSeries(weekly, [movedOut, movedIn], OCTOBER);
    expect(starts(found)).toEqual(["2026-10-05T07:00:00Z", "2026-10-19T07:00:00Z", "2026-10-26T08:00:00Z"]);
  });

  it("takes an occurrence that started before the range and is still going", () => {
    // 22:00 to 02:00 in Bucharest, asked for 17 October from midnight.
    const night = series("2026-10-15T19:00:00Z", "2026-10-15T23:00:00Z", { freq: "daily", end: never });
    const day = range("2026-10-17T00:00:00+03:00", "2026-10-18T00:00:00+03:00");
    expect(starts(expandSeries(night, [], day))).toEqual(["2026-10-16T19:00:00Z", "2026-10-17T19:00:00Z"]);
    // One that ends exactly at the start of the range is not in it.
    const evening = series("2026-10-15T18:00:00Z", "2026-10-15T21:00:00Z", { freq: "daily", end: never });
    expect(starts(expandSeries(evening, [], day))).toEqual(["2026-10-17T18:00:00Z"]);
  });

  it("matches all-day occurrences on the range's dates in the display time zone", () => {
    // Friday and Saturday, every week.
    const weekend = series("2026-10-02", "2026-10-04", { freq: "weekly", end: never });
    const saturday = range("2026-10-17T00:00:00+03:00", "2026-10-18T00:00:00+03:00");
    expect(starts(expandSeries(weekend, [], saturday))).toEqual(["2026-10-16"]);
    // The same instants are 16 Oct 21:00 to 17 Oct 21:00 in UTC: Friday and Saturday.
    const inUtc = range("2026-10-17T00:00:00+03:00", "2026-10-18T00:00:00+03:00", "UTC");
    expect(starts(expandSeries(weekend, [], inUtc))).toEqual(["2026-10-16"]);
    const sunday = range("2026-10-18T00:00:00+03:00", "2026-10-19T00:00:00+03:00");
    expect(starts(expandSeries(weekend, [], sunday))).toEqual([]);
  });

  it("stops at the cap for a rule that would run away", () => {
    // Every day, each lasting three years: every one of them overlaps a year's range.
    const endless = series("2020-01-01", "2023-01-01", { freq: "daily", end: never });
    const found = expandSeries(endless, [], range("2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z"));
    expect(found).toHaveLength(MAX_OCCURRENCES_PER_SERIES);
  });

  it("finds nothing before the series starts or after it ends", () => {
    const later = series("2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z", { freq: "weekly", end: never });
    expect(expandSeries(later, [], OCTOBER)).toEqual([]);
    const over = series("2026-09-01T07:00:00Z", "2026-09-01T08:00:00Z", { freq: "daily", end: { type: "count", count: 10 } });
    expect(expandSeries(over, [], OCTOBER)).toEqual([]);
  });
});

describe("rule helpers", () => {
  const weekly = series("2026-10-19T07:00:00Z", "2026-10-19T08:00:00Z", { freq: "weekly", end: { type: "count", count: 4 } });

  it("knows which keys the rule generates", () => {
    expect(isGenerated(weekly, "2026-10-26T08:00:00Z")).toBe(true);
    expect(isGenerated(weekly, "2026-10-26T07:00:00Z")).toBe(false);
    expect(isGenerated(weekly, "2026-11-16T08:00:00Z")).toBe(false);
    expect(isGenerated(series("2026-10-16", "2026-10-17", { freq: "monthly", end: never }), "2026-12-16")).toBe(true);
  });

  it("walks to the next and previous keys, skipping excluded ones", () => {
    const skip = new Set(["2026-10-26T08:00:00Z"]);
    expect(nextKey(weekly, "2026-10-19T07:00:00Z")).toBe("2026-10-19T07:00:00Z");
    expect(nextKey(weekly, "2026-10-20T00:00:00Z", skip)).toBe("2026-11-02T08:00:00Z");
    expect(nextKey(weekly, "2026-11-10T00:00:00Z")).toBeUndefined();
    expect(previousKey(weekly, "2026-11-02T08:00:00Z", skip)).toBe("2026-10-19T07:00:00Z");
    expect(previousKey(weekly, "2026-10-19T07:00:00Z")).toBeUndefined();
  });

  it("counts the occurrences before a key", () => {
    expect(countBefore(weekly, "2026-10-19T07:00:00Z")).toBe(0);
    expect(countBefore(weekly, "2026-11-02T08:00:00Z")).toBe(2);
    expect(countBefore(weekly, "2026-11-02T08:00:00Z")).toBe(2);
  });

  it("works out an occurrence's end on the wall clock", () => {
    expect(occurrenceEnd(weekly, "2026-10-26T08:00:00Z")).toBe("2026-10-26T09:00:00Z");
    expect(occurrenceEnd(series("2026-10-16", "2026-10-19", { freq: "monthly", end: never }), "2026-11-16")).toBe("2026-11-19");
  });

  it("moves a start forward to the first day the rule repeats on", () => {
    // Friday 16 October, weekly on Monday.
    const timing = { allDay: false, start: "2026-10-16T07:00:00Z", end: "2026-10-16T08:00:00Z", tzid: ZONE, rrule: "FREQ=WEEKLY;BYDAY=MO" };
    expect(snapToFirst(timing)).toEqual({ ...timing, start: "2026-10-19T07:00:00Z", end: "2026-10-19T08:00:00Z" });
    const already = { ...timing, rrule: "FREQ=WEEKLY;BYDAY=FR" };
    expect(snapToFirst(already)).toBe(already);
    expect(snapToFirst({ ...timing, rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261018T205959Z" })).toBeUndefined();
  });
});

describe("searchOccurrence", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const today = "2026-10-21";

  it("answers the next occurrence that has not ended", () => {
    const weekly = series("2026-10-05T07:00:00Z", "2026-10-05T08:00:00Z", { freq: "weekly", end: never });
    expect(searchOccurrence(weekly, [], now, today)?.start).toBe("2026-10-26T08:00:00Z");
    // One going on now is the next.
    const long = series("2026-10-05T07:00:00Z", "2026-10-05T17:00:00Z", { freq: "daily", end: never });
    expect(searchOccurrence(long, [], now, today)?.start).toBe("2026-10-21T07:00:00Z");
  });

  it("skips excluded dates and exceptions", () => {
    const weekly = series("2026-10-05T07:00:00Z", "2026-10-05T08:00:00Z", { freq: "weekly", end: never }, {
      exdates: ["2026-10-26T08:00:00Z"],
    });
    const moved = exception("2026-11-02T08:00:00Z", "2026-11-03T08:00:00Z", "2026-11-03T09:00:00Z");
    expect(searchOccurrence(weekly, [moved], now, today)?.start).toBe("2026-11-09T08:00:00Z");
  });

  it("answers the last occurrence of a series that is over, and nothing when none is left", () => {
    const over = series("2026-09-01T07:00:00Z", "2026-09-01T08:00:00Z", { freq: "daily", end: { type: "count", count: 10 } });
    expect(searchOccurrence(over, [], now, today)?.start).toBe("2026-09-10T07:00:00Z");
    const gone = series("2026-09-01T07:00:00Z", "2026-09-01T08:00:00Z", { freq: "daily", end: { type: "count", count: 1 } }, {
      exdates: ["2026-09-01T07:00:00Z"],
    });
    expect(searchOccurrence(gone, [], now, today)).toBeUndefined();
  });

  it("measures all-day occurrences against today's date", () => {
    const weekly = series("2026-10-07", "2026-10-08", { freq: "weekly", end: never });
    expect(searchOccurrence(weekly, [], now, today)?.start).toBe("2026-10-21");
    expect(searchOccurrence(weekly, [], now, "2026-10-22")?.start).toBe("2026-10-28");
    const over = series("2026-09-01", "2026-09-02", { freq: "daily", end: { type: "count", count: 3 } });
    expect(searchOccurrence(over, [], now, today)?.start).toBe("2026-09-03");
  });
});
