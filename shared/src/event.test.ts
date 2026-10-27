import { describe, expect, it } from "vitest";
import {
  ALL_DAY_REMINDERS,
  EVENT_LENGTH_MAX_DAYS,
  TIMED_REMINDERS,
  describeReminder,
  REPEAT_UNTIL_MAX,
  compareOccurrences,
  eventChangesSchema,
  eventInputSchema,
  eventOccurrenceId,
  eventPatchSchema,
  occurrenceQuerySchema,
  parseOccurrenceId,
  repeatSchema,
  seriesOccurrenceId,
  type Occurrence,
} from "./event.js";
import { addDays } from "./time.js";

const timed = {
  calendarId: 1,
  title: "Standup",
  allDay: false,
  start: "2026-10-16T10:00:00+03:00",
  end: "2026-10-16T10:15:00+03:00",
};

/** The first issue's path and message, as the API's error message would name them. */
function issue(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  expect(result.success).toBe(false);
  const first = result.error?.issues[0];
  return `${first?.path.map(String).join(".")}: ${first?.message}`;
}

describe("eventInputSchema", () => {
  it("fills the defaults and turns timed times into UTC with Z", () => {
    expect(eventInputSchema.parse(timed)).toEqual({
      calendarId: 1,
      title: "Standup",
      location: "",
      notes: "",
      allDay: false,
      start: "2026-10-16T07:00:00Z",
      end: "2026-10-16T07:15:00Z",
      repeat: null,
      reminderMinutes: null,
    });
  });

  it("takes dates for an all-day event, the end exclusive", () => {
    const parsed = eventInputSchema.parse({ ...timed, allDay: true, start: "2026-10-16", end: "2026-10-17" });
    expect(parsed).toMatchObject({ allDay: true, start: "2026-10-16", end: "2026-10-17" });
  });

  it("refuses times of the wrong kind for allDay", () => {
    expect(issue(eventInputSchema.safeParse({ ...timed, allDay: true }))).toMatch(/^start: must be a date/);
    expect(issue(eventInputSchema.safeParse({ ...timed, start: "2026-10-16", end: "2026-10-17" }))).toMatch(
      /^start: must be an ISO date and time/,
    );
  });

  it("refuses an end that is not after the start", () => {
    expect(issue(eventInputSchema.safeParse({ ...timed, end: timed.start }))).toBe("end: must be after the start");
    expect(
      issue(eventInputSchema.safeParse({ ...timed, allDay: true, start: "2026-10-16", end: "2026-10-16" })),
    ).toBe("end: must be after the start");
  });

  it("refuses an event longer than EVENT_LENGTH_MAX_DAYS, timed or all-day", () => {
    const last = addDays("2026-10-16", EVENT_LENGTH_MAX_DAYS);
    const tooLong = `end: must be at most ${EVENT_LENGTH_MAX_DAYS} days after the start`;
    expect(eventInputSchema.safeParse({ ...timed, start: "2026-10-16T07:00:00Z", end: `${last}T07:00:00Z` }).success).toBe(true);
    expect(issue(eventInputSchema.safeParse({ ...timed, start: "2026-10-16T07:00:00Z", end: `${last}T07:00:01Z` }))).toBe(tooLong);
    const allDay = { ...timed, allDay: true, start: "2026-10-16" };
    expect(eventInputSchema.safeParse({ ...allDay, end: last }).success).toBe(true);
    expect(issue(eventInputSchema.safeParse({ ...allDay, end: addDays(last, 1) }))).toBe(tooLong);
    expect(issue(eventInputSchema.safeParse({ ...allDay, end: "9999-12-31" }))).toBe(tooLong);
  });

  it("trims the title, and refuses a blank or long one and unknown keys", () => {
    expect(eventInputSchema.parse({ ...timed, title: "  Standup  " }).title).toBe("Standup");
    expect(issue(eventInputSchema.safeParse({ ...timed, title: "   " }))).toBe("title: an event needs a title");
    expect(eventInputSchema.safeParse({ ...timed, title: "x".repeat(201) }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...timed, colour: "red" }).success).toBe(false);
  });

  it("takes a repeat preset", () => {
    const repeat = { freq: "weekly", byDay: ["FR", "MO", "FR"], end: { type: "count", count: 10 } };
    expect(eventInputSchema.parse({ ...timed, repeat }).repeat).toEqual({
      freq: "weekly",
      byDay: ["MO", "FR"],
      end: { type: "count", count: 10 },
    });
  });
});

describe("reminders", () => {
  const allDay = { ...timed, allDay: true, start: "2026-10-16", end: "2026-10-17" };

  it("offers phone calendars' choices for each kind", () => {
    expect(TIMED_REMINDERS).toEqual([0, 5, 10, 15, 30, 60, 120, 1440]);
    expect(ALL_DAY_REMINDERS).toEqual([-540, 900]);
  });

  it("takes a listed reminder for the event's kind, and none", () => {
    expect(eventInputSchema.parse({ ...timed, reminderMinutes: 10 }).reminderMinutes).toBe(10);
    expect(eventInputSchema.parse({ ...timed, reminderMinutes: 0 }).reminderMinutes).toBe(0);
    expect(eventInputSchema.parse({ ...allDay, reminderMinutes: 900 }).reminderMinutes).toBe(900);
    expect(eventInputSchema.parse({ ...allDay, reminderMinutes: -540 }).reminderMinutes).toBe(-540);
    expect(eventInputSchema.parse({ ...timed, reminderMinutes: null }).reminderMinutes).toBeNull();
  });

  it("refuses anything else, and one of the other kind's", () => {
    for (const reminderMinutes of [7, -5, 2880, 10.5, "10"]) {
      expect(issue(eventInputSchema.safeParse({ ...timed, reminderMinutes }))).toMatch(/^reminderMinutes: /);
    }
    expect(issue(eventInputSchema.safeParse({ ...timed, reminderMinutes: 900 }))).toBe(
      "reminderMinutes: must be null or one of 0, 5, 10, 15, 30, 60, 120, 1440 for a timed event",
    );
    expect(issue(eventInputSchema.safeParse({ ...allDay, reminderMinutes: 10 }))).toBe(
      "reminderMinutes: must be null or one of -540, 900 for an all-day event",
    );
  });

  it("says each in words", () => {
    expect(TIMED_REMINDERS.map((minutes) => describeReminder(minutes, false))).toEqual([
      "at the start",
      "5 minutes before",
      "10 minutes before",
      "15 minutes before",
      "30 minutes before",
      "1 hour before",
      "2 hours before",
      "1 day before",
    ]);
    expect(ALL_DAY_REMINDERS.map((minutes) => describeReminder(minutes, true))).toEqual([
      "on the day at 09:00",
      "the day before at 09:00",
    ]);
  });
});

describe("repeatSchema", () => {
  it("takes each end", () => {
    for (const end of [{ type: "never" }, { type: "until", date: "2026-12-01" }, { type: "count", count: 730 }]) {
      expect(repeatSchema.safeParse({ freq: "daily", end }).success, end.type).toBe(true);
    }
  });

  it("refuses an end date after REPEAT_UNTIL_MAX, which a zone behind UTC would push past the year 9999", () => {
    expect(repeatSchema.safeParse({ freq: "daily", end: { type: "until", date: REPEAT_UNTIL_MAX } }).success).toBe(true);
    expect(issue(repeatSchema.safeParse({ freq: "daily", end: { type: "until", date: "9999-01-01" } }))).toBe(
      `end.date: must be on or before ${REPEAT_UNTIL_MAX}`,
    );
  });

  it("refuses byDay outside weekly, an empty byDay, and a count out of range", () => {
    expect(issue(repeatSchema.safeParse({ freq: "daily", byDay: ["MO"], end: { type: "never" } }))).toBe(
      "byDay: is for a weekly repeat only",
    );
    expect(repeatSchema.safeParse({ freq: "weekly", byDay: [], end: { type: "never" } }).success).toBe(false);
    expect(repeatSchema.safeParse({ freq: "daily", end: { type: "count", count: 731 } }).success).toBe(false);
    expect(repeatSchema.safeParse({ freq: "daily", end: { type: "count", count: 0 } }).success).toBe(false);
    expect(repeatSchema.safeParse({ freq: "hourly", end: { type: "never" } }).success).toBe(false);
  });
});

describe("eventPatchSchema", () => {
  it("takes any subset of the fields without filling defaults", () => {
    expect(eventPatchSchema.parse({ changes: { title: "Retro" } })).toEqual({ changes: { title: "Retro" } });
    expect(eventChangesSchema.parse({})).toEqual({});
  });

  it("checks scope and the occurrence key", () => {
    expect(eventPatchSchema.safeParse({ scope: "this", occurrence: "2026-10-16T07:00:00Z", changes: {} }).success).toBe(
      true,
    );
    expect(eventPatchSchema.safeParse({ scope: "some", changes: {} }).success).toBe(false);
    expect(eventPatchSchema.safeParse({ occurrence: "2026-10-16T10:00:00+03:00", changes: {} }).success).toBe(false);
  });
});

describe("occurrenceQuerySchema", () => {
  it("takes a range up to 400 days, an unescaped + included", () => {
    expect(occurrenceQuerySchema.parse({ from: "2026-10-01T00:00:00 03:00", to: "2026-11-01T00:00:00Z" })).toEqual({
      from: "2026-09-30T21:00:00Z",
      to: "2026-11-01T00:00:00Z",
    });
    expect(occurrenceQuerySchema.safeParse({ from: "2026-01-01T00:00:00Z", to: "2027-02-05T00:00:00Z" }).success).toBe(
      true,
    );
  });

  it("refuses an empty, backwards or too long range", () => {
    expect(issue(occurrenceQuerySchema.safeParse({ from: "2026-10-01T00:00:00Z", to: "2026-10-01T00:00:00Z" }))).toBe(
      "to: must be after from",
    );
    expect(issue(occurrenceQuerySchema.safeParse({ from: "2026-01-01T00:00:00Z", to: "2027-02-05T00:00:01Z" }))).toBe(
      "to: must be at most 400 days after from",
    );
    expect(occurrenceQuerySchema.safeParse({ from: "2026-10-01T00:00:00Z" }).success).toBe(false);
  });
});

describe("occurrence ids", () => {
  it("name a row or a generated occurrence, and parse back", () => {
    expect(eventOccurrenceId(12)).toBe("e12");
    expect(seriesOccurrenceId(7, "2026-10-16T07:00:00Z")).toBe("s7:2026-10-16T07:00:00Z");
    expect(parseOccurrenceId("e12")).toEqual({ kind: "event", eventId: 12 });
    expect(parseOccurrenceId("s7:2026-10-16")).toEqual({ kind: "series", seriesId: 7, key: "2026-10-16" });
    for (const id of ["e0", "e", "x12", "s7", "s7:tomorrow", "s0:2026-10-16"]) expect(parseOccurrenceId(id), id).toBe(undefined);
  });
});

describe("compareOccurrences", () => {
  const base: Occurrence = {
    id: "e1",
    eventId: 1,
    seriesId: null,
    originalStart: null,
    calendarId: 1,
    title: "x",
    location: "",
    notes: "",
    allDay: false,
    start: "2026-10-16T07:00:00Z",
    end: "2026-10-16T08:00:00Z",
    repeat: null,
    reminderMinutes: null,
  };
  const make = (id: string, fields: Partial<Occurrence>): Occurrence => ({ ...base, id, ...fields });

  it("orders by local date, all-day first, then time, longer first", () => {
    const early = make("e1", { start: "2026-10-15T22:30:00Z", end: "2026-10-15T23:00:00Z" }); // 01:30 on the 16th in Bucharest
    const allDay = make("e2", { allDay: true, start: "2026-10-16", end: "2026-10-17" });
    const nine = make("e3", { start: "2026-10-16T06:00:00Z", end: "2026-10-16T07:00:00Z" });
    const nineLong = make("e4", { start: "2026-10-16T06:00:00Z", end: "2026-10-16T09:00:00Z" });
    const dayBefore = make("e5", { allDay: true, start: "2026-10-15", end: "2026-10-16" });
    const sorted = [nine, allDay, early, nineLong, dayBefore].sort(compareOccurrences("Europe/Bucharest"));
    expect(sorted.map((o) => o.id)).toEqual(["e5", "e2", "e1", "e4", "e3"]);
    // In UTC the early one is still the 15th, after that day's all-day event.
    const utc = [nine, allDay, early, dayBefore].sort(compareOccurrences("UTC"));
    expect(utc.map((o) => o.id)).toEqual(["e5", "e1", "e2", "e3"]);
  });
});
