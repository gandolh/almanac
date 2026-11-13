import { describe, expect, it } from "vitest";
import { formatOffset, vtimezoneLines } from "./vtimezone.js";

describe("vtimezoneLines", () => {
  it("gives Bucharest its last-Sunday rules, read in the offset before each change", () => {
    expect(vtimezoneLines("Europe/Bucharest", 2026)).toEqual([
      "BEGIN:VTIMEZONE",
      "TZID:Europe/Bucharest",
      "X-LIC-LOCATION:Europe/Bucharest",
      "BEGIN:DAYLIGHT",
      "DTSTART:19700329T030000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
      "TZOFFSETFROM:+0200",
      "TZOFFSETTO:+0300",
      "END:DAYLIGHT",
      "BEGIN:STANDARD",
      "DTSTART:19701025T040000",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
      "TZOFFSETFROM:+0300",
      "TZOFFSETTO:+0200",
      "END:STANDARD",
      "END:VTIMEZONE",
    ]);
  });

  it("counts a weekday from the start of the month where that is the rule (New York)", () => {
    const lines = vtimezoneLines("America/New_York", 2026);
    expect(lines).toContain("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU");
    expect(lines).toContain("RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU");
    expect(lines).toContain("DTSTART:19700308T020000");
    expect(lines).toContain("DTSTART:19701101T020000");
  });

  it("gives a zone without summer time one standard observance", () => {
    expect(vtimezoneLines("Asia/Tokyo", 2026)).toEqual([
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Tokyo",
      "X-LIC-LOCATION:Asia/Tokyo",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0900",
      "TZOFFSETTO:+0900",
      "END:STANDARD",
      "END:VTIMEZONE",
    ]);
    expect(vtimezoneLines("UTC", 2026)).toContain("TZOFFSETTO:+0000");
  });

  it("puts a southern-hemisphere zone's summer in October and its winter in April (Sydney)", () => {
    const lines = vtimezoneLines("Australia/Sydney", 2026);
    const daylight = lines.slice(lines.indexOf("BEGIN:DAYLIGHT"), lines.indexOf("END:DAYLIGHT"));
    const standard = lines.slice(lines.indexOf("BEGIN:STANDARD"), lines.indexOf("END:STANDARD"));
    expect(daylight).toEqual([
      "BEGIN:DAYLIGHT",
      "DTSTART:19701004T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU",
      "TZOFFSETFROM:+1000",
      "TZOFFSETTO:+1100",
    ]);
    expect(standard).toEqual([
      "BEGIN:STANDARD",
      "DTSTART:19700405T030000",
      "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU",
      "TZOFFSETFROM:+1100",
      "TZOFFSETTO:+1000",
    ]);
  });

  it("lists the changes one by one in a zone no weekday rule fits", () => {
    const lines = vtimezoneLines("Asia/Jerusalem", 2026);
    expect(lines.some((line) => line.startsWith("RRULE"))).toBe(false);
    // The offset before the first listed change, then two changes a year for the twelve years listed.
    expect(lines.filter((line) => line === "BEGIN:DAYLIGHT").length).toBeGreaterThanOrEqual(12);
    expect(lines.at(-1)).toBe("END:VTIMEZONE");
  });
});

describe("formatOffset", () => {
  it("writes hours and minutes, and seconds only when there are some", () => {
    expect(formatOffset(3 * 3600e9)).toBe("+0300");
    expect(formatOffset(-(3 * 3600 + 30 * 60) * 1e9)).toBe("-0330");
    expect(formatOffset(0)).toBe("+0000");
    expect(formatOffset((5 * 3600 + 53 * 60 + 28) * 1e9)).toBe("+055328");
  });
});
