import { describe, expect, it } from "vitest";
import {
  addDays,
  allDayRange,
  dateInZone,
  formatInstant,
  instantSchema,
  isDateKey,
  isIanaZone,
  occurrenceKeySchema,
} from "./time.js";

const at = (iso: string) => Date.parse(iso);

describe("isIanaZone", () => {
  it("takes IANA names and UTC", () => {
    for (const zone of ["Europe/Bucharest", "America/Argentina/Buenos_Aires", "Etc/GMT+2", "Europe/Kyiv", "UTC"]) {
      expect(isIanaZone(zone), zone).toBe(true);
    }
  });

  it("refuses what Intl takes but is not a name, and names nobody knows", () => {
    for (const zone of ["+02:00", "EST", "GMT", "europe/bucharest", "Mars/Olympus", "", "Europe/"]) {
      expect(isIanaZone(zone), zone).toBe(false);
    }
  });
});

describe("instants", () => {
  it("formats whole seconds in UTC with Z", () => {
    expect(formatInstant(at("2026-10-16T07:00:00.999Z"))).toBe("2026-10-16T07:00:00Z");
  });

  it("turns any offset into the one form", () => {
    expect(instantSchema.parse("2026-10-16T10:00:00+03:00")).toBe("2026-10-16T07:00:00Z");
    expect(instantSchema.parse("2026-10-16T07:00:00.250Z")).toBe("2026-10-16T07:00:00Z");
  });

  it("refuses a time with no zone, a date, and nonsense", () => {
    for (const value of ["2026-10-16T07:00:00", "2026-10-16", "tomorrow", "2026-02-30T10:00:00Z"]) {
      expect(instantSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("occurrence keys", () => {
  it("are an instant in the one form, or a date", () => {
    expect(occurrenceKeySchema.safeParse("2026-10-16T07:00:00Z").success).toBe(true);
    expect(occurrenceKeySchema.safeParse("2026-10-16").success).toBe(true);
    expect(isDateKey("2026-10-16")).toBe(true);
    expect(isDateKey("2026-10-16T07:00:00Z")).toBe(false);
  });

  it("refuses other spellings of the same time", () => {
    for (const value of ["2026-10-16T07:00:00.000Z", "2026-10-16T10:00:00+03:00", "2026-10-16T07:00Z", "2026-13-01"]) {
      expect(occurrenceKeySchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("dates", () => {
  it("reads the date an instant falls on in a zone", () => {
    // 22:30 UTC is already the next day in Bucharest (UTC+3 in summer).
    expect(dateInZone(at("2026-10-15T22:30:00Z"), "Europe/Bucharest")).toBe("2026-10-16");
    expect(dateInZone(at("2026-10-15T22:30:00Z"), "UTC")).toBe("2026-10-15");
    expect(dateInZone(at("2026-10-16T03:00:00Z"), "America/New_York")).toBe("2026-10-15");
  });

  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("0050-01-01", 1)).toBe("0050-01-02");
  });
});

describe("allDayRange", () => {
  const zone = "Europe/Bucharest";

  it("covers one day for local midnight to midnight, the end not pulling in the next day", () => {
    expect(allDayRange(at("2026-10-15T21:00:00Z"), at("2026-10-16T21:00:00Z"), zone)).toEqual({
      start: "2026-10-16",
      end: "2026-10-17",
    });
  });

  it("covers the day an end inside a day falls on", () => {
    expect(allDayRange(at("2026-10-16T09:00:00Z"), at("2026-10-16T21:00:01Z"), zone)).toEqual({
      start: "2026-10-16",
      end: "2026-10-18",
    });
  });

  it("uses the zone, not UTC: a UTC-midnight range is two local days", () => {
    expect(allDayRange(at("2026-10-16T00:00:00Z"), at("2026-10-17T00:00:00Z"), zone)).toEqual({
      start: "2026-10-16",
      end: "2026-10-18",
    });
    expect(allDayRange(at("2026-10-16T00:00:00Z"), at("2026-10-17T00:00:00Z"), "UTC")).toEqual({
      start: "2026-10-16",
      end: "2026-10-17",
    });
  });

  it("follows the zone's offset across the end of summer time (25 October 2026)", () => {
    // The week of 19 October, Monday to Monday, local midnights: +03:00 then +02:00.
    expect(allDayRange(at("2026-10-18T21:00:00Z"), at("2026-10-25T22:00:00Z"), zone)).toEqual({
      start: "2026-10-19",
      end: "2026-10-26",
    });
  });
});
