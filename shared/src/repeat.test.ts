import { describe, expect, it } from "vitest";
import type { Repeat, RepeatEnd } from "./event.js";
import { describeRepeat, repeatToRRule, rruleToRepeat, startDate, weekdayOf } from "./repeat.js";

const BUCHAREST = "Europe/Bucharest";
const never: RepeatEnd = { type: "never" };
/** Friday 16 October 2026, 10:00 in Bucharest (UTC+3). */
const FRIDAY_TEN = "2026-10-16T07:00:00Z";

describe("startDate and weekdayOf", () => {
  it("reads an instant's date in the zone, and a date as it is", () => {
    expect(startDate("2026-10-15T21:30:00Z", BUCHAREST)).toBe("2026-10-16");
    expect(startDate("2026-10-15T21:30:00Z", "UTC")).toBe("2026-10-15");
    expect(startDate("2026-10-16", "America/New_York")).toBe("2026-10-16");
  });

  it("names the weekday, Monday first", () => {
    expect(weekdayOf("2026-10-19")).toBe("MO");
    expect(weekdayOf("2026-10-16")).toBe("FR");
    expect(weekdayOf("2026-10-18")).toBe("SU");
    expect(weekdayOf("0099-01-01")).toBe("TH");
  });
});

describe("repeatToRRule", () => {
  const rule = (repeat: Repeat, start = FRIDAY_TEN, zone = BUCHAREST) => repeatToRRule(repeat, start, zone);

  it("writes each preset, the days spelled out", () => {
    expect(rule({ freq: "daily", end: never })).toBe("FREQ=DAILY");
    expect(rule({ freq: "weekdays", end: never })).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(rule({ freq: "weekly", byDay: ["MO", "WE"], end: never })).toBe("FREQ=WEEKLY;BYDAY=MO,WE");
    expect(rule({ freq: "monthly", end: never })).toBe("FREQ=MONTHLY;BYMONTHDAY=16");
    expect(rule({ freq: "yearly", end: never })).toBe("FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=16");
  });

  it("repeats weekly on the start's weekday when no days are given", () => {
    expect(rule({ freq: "weekly", end: never })).toBe("FREQ=WEEKLY;BYDAY=FR");
    expect(rule({ freq: "weekly", byDay: [], end: never })).toBe("FREQ=WEEKLY;BYDAY=FR");
    expect(rule({ freq: "weekly", byDay: ["WE", "MO", "WE"], end: never })).toBe("FREQ=WEEKLY;BYDAY=MO,WE");
  });

  it("follows the start's date in the series' zone, not in UTC", () => {
    // 16 October 00:30 in Bucharest is still the 15th in UTC.
    const start = "2026-10-15T21:30:00Z";
    expect(rule({ freq: "weekly", end: never }, start)).toBe("FREQ=WEEKLY;BYDAY=FR");
    expect(rule({ freq: "monthly", end: never }, start)).toBe("FREQ=MONTHLY;BYMONTHDAY=16");
    expect(rule({ freq: "monthly", end: never }, start, "UTC")).toBe("FREQ=MONTHLY;BYMONTHDAY=15");
    expect(rule({ freq: "yearly", end: never }, "2026-02-28T22:30:00Z")).toBe("FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=1");
  });

  it("ends after a count", () => {
    expect(rule({ freq: "daily", end: { type: "count", count: 10 } })).toBe("FREQ=DAILY;COUNT=10");
  });

  it("ends on a date as the last second of that date in the zone, in UTC, for a timed series", () => {
    const until = (date: string, zone = BUCHAREST) => rule({ freq: "daily", end: { type: "until", date } }, FRIDAY_TEN, zone);
    // Winter time (UTC+2), summer time (UTC+3), and the day summer time ends.
    expect(until("2026-12-01")).toBe("FREQ=DAILY;UNTIL=20261201T215959Z");
    expect(until("2026-07-01")).toBe("FREQ=DAILY;UNTIL=20260701T205959Z");
    expect(until("2026-10-25")).toBe("FREQ=DAILY;UNTIL=20261025T215959Z");
    expect(until("2026-11-01", "America/New_York")).toBe("FREQ=DAILY;UNTIL=20261102T045959Z");
    expect(until("2026-12-01", "UTC")).toBe("FREQ=DAILY;UNTIL=20261201T235959Z");
    expect(until("2026-12-01", "Pacific/Kiritimati")).toBe("FREQ=DAILY;UNTIL=20261201T095959Z");
    // Santiago's clocks go back from midnight to 23:00 on 4 April: 23:59:59 happens twice, the later one counts.
    expect(until("2026-04-04", "America/Santiago")).toBe("FREQ=DAILY;UNTIL=20260405T035959Z");
    // The last date the schema takes (REPEAT_UNTIL_MAX), in a zone behind UTC, still has a four-digit year.
    expect(until("9998-12-31", "Pacific/Pago_Pago")).toBe("FREQ=DAILY;UNTIL=99990101T105959Z");
  });

  it("ends on a date as the date for an all-day series", () => {
    expect(rule({ freq: "weekly", end: { type: "until", date: "2026-12-01" } }, "2026-10-19")).toBe(
      "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261201",
    );
  });
});

describe("rruleToRepeat", () => {
  const presets: Repeat[] = [
    { freq: "daily", end: never },
    { freq: "weekdays", end: { type: "count", count: 5 } },
    { freq: "weekly", byDay: ["MO", "WE", "SU"], end: { type: "until", date: "2026-12-01" } },
    { freq: "monthly", end: { type: "until", date: "2027-10-25" } },
    { freq: "yearly", end: { type: "count", count: 730 } },
  ];

  it("gives back what repeatToRRule wrote, timed or all-day", () => {
    for (const repeat of presets) {
      for (const [start, zone] of [
        [FRIDAY_TEN, BUCHAREST],
        ["2026-10-16T03:00:00Z", "America/New_York"],
        ["2026-10-16", BUCHAREST],
      ] as const) {
        expect(rruleToRepeat(repeatToRRule(repeat, start, zone), start, zone), `${repeat.freq} ${start}`).toEqual(repeat);
      }
    }
  });

  it("fills a weekly rule's days, and reads Monday to Friday as every weekday", () => {
    expect(rruleToRepeat("FREQ=WEEKLY", FRIDAY_TEN, BUCHAREST)).toEqual({ freq: "weekly", byDay: ["FR"], end: never });
    expect(rruleToRepeat("FREQ=WEEKLY", "2026-10-19", BUCHAREST)).toEqual({ freq: "weekly", byDay: ["MO"], end: never });
    expect(rruleToRepeat("FREQ=WEEKLY;BYDAY=FR,TH,WE,TU,MO", FRIDAY_TEN, BUCHAREST)).toEqual({ freq: "weekdays", end: never });
    expect(rruleToRepeat("RRULE:FREQ=MONTHLY", FRIDAY_TEN, BUCHAREST)).toEqual({ freq: "monthly", end: never });
  });

  it("reads a UTC UNTIL as its date in the zone, and a date UNTIL as it is", () => {
    expect(rruleToRepeat("FREQ=DAILY;UNTIL=20261201T215959Z", FRIDAY_TEN, BUCHAREST).end).toEqual({ type: "until", date: "2026-12-01" });
    expect(rruleToRepeat("FREQ=DAILY;UNTIL=20261201T215959Z", FRIDAY_TEN, "UTC").end).toEqual({ type: "until", date: "2026-12-01" });
    expect(rruleToRepeat("FREQ=DAILY;UNTIL=20261202T005959Z", FRIDAY_TEN, BUCHAREST).end).toEqual({ type: "until", date: "2026-12-02" });
    expect(rruleToRepeat("FREQ=DAILY;UNTIL=20261201", "2026-10-16", BUCHAREST).end).toEqual({ type: "until", date: "2026-12-01" });
  });

  it("refuses a rule that is not a preset", () => {
    for (const rrule of [
      "FREQ=HOURLY",
      "FREQ=DAILY;INTERVAL=2",
      "FREQ=DAILY;COUNT=0",
      "FREQ=DAILY;COUNT=3;UNTIL=20261201",
      "FREQ=DAILY;COUNT=3;COUNT=4",
      "FREQ=DAILY;UNTIL=2026-12-01",
      "FREQ=MONTHLY;BYDAY=1MO",
      "FREQ=WEEKLY;BYDAY=1MO",
      "FREQ=DAILY;BYDAY=MO",
      "",
    ]) {
      expect(() => rruleToRepeat(rrule, FRIDAY_TEN, BUCHAREST), rrule).toThrow(/Not a repeat preset/);
    }
  });
});

describe("describeRepeat", () => {
  const say = (repeat: Repeat, start = FRIDAY_TEN) => describeRepeat(repeat, start, BUCHAREST);

  it("names each preset as the UI shows it", () => {
    expect(say({ freq: "daily", end: never })).toBe("Daily");
    expect(say({ freq: "weekdays", end: never })).toBe("Every weekday (Monday to Friday)");
    expect(say({ freq: "weekly", byDay: ["MO", "WE"], end: never })).toBe("Weekly on Monday, Wednesday");
    expect(say({ freq: "weekly", end: never })).toBe("Weekly on Friday");
    expect(say({ freq: "monthly", end: never })).toBe("Monthly on day 16");
    expect(say({ freq: "yearly", end: never })).toBe("Annually on 16 October");
  });

  it("says how it ends", () => {
    expect(say({ freq: "daily", end: { type: "until", date: "2026-12-01" } })).toBe("Daily, until 1 Dec 2026");
    expect(say({ freq: "monthly", end: { type: "count", count: 10 } })).toBe("Monthly on day 16, 10 times");
    expect(say({ freq: "daily", end: { type: "count", count: 1 } })).toBe("Daily, 1 time");
  });

  it("follows the start's date in the zone, or a date as it is", () => {
    expect(say({ freq: "yearly", end: never }, "2026-10-15T21:30:00Z")).toBe("Annually on 16 October");
    expect(describeRepeat({ freq: "yearly", end: never }, "2026-10-15T21:30:00Z", "UTC")).toBe("Annually on 15 October");
    expect(say({ freq: "monthly", end: never }, "2026-02-01")).toBe("Monthly on day 1");
    expect(say({ freq: "weekly", end: never }, "2026-10-18")).toBe("Weekly on Sunday");
  });
});
