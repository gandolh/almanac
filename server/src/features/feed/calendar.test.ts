import { describe, expect, it } from "vitest";
import type { EventRecord } from "../events/index.js";
import { feedCalendar, uidOf } from "./calendar.js";

const NOW = new Date("2026-11-13T12:00:00Z");

function record(fields: Partial<EventRecord> & Pick<EventRecord, "id" | "title" | "start" | "end">): EventRecord {
  return {
    calendarId: 1,
    location: "",
    notes: "",
    allDay: false,
    reminderMinutes: null,
    tzid: "Europe/Bucharest",
    rrule: null,
    exdates: [],
    seriesId: null,
    originalStart: null,
    createdAt: "2026-10-01T08:00:00.123Z",
    updatedAt: "2026-10-02T09:30:00.456Z",
    ...fields,
  };
}

/** The standup: weekdays at 09:30 in Bucharest, one deleted occurrence and one moved. */
const SERIES = record({
  id: 3,
  title: "Team standup",
  start: "2026-10-05T06:30:00Z",
  end: "2026-10-05T07:00:00Z",
  rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  exdates: ["2026-10-22T06:30:00Z", "2026-10-29T07:30:00Z"],
  reminderMinutes: 10,
});
const EXCEPTION = record({
  id: 9,
  title: "Standup, moved",
  start: "2026-10-21T08:00:00Z",
  end: "2026-10-21T08:30:00Z",
  seriesId: 3,
  originalStart: "2026-10-21T06:30:00Z",
  createdAt: "2026-10-03T10:00:00.000Z",
  updatedAt: "2026-10-03T10:00:00.000Z",
});
const ONE_OFF = record({
  id: 1,
  title: "Dentist",
  start: "2026-10-20T05:30:00Z",
  end: "2026-10-20T06:30:00Z",
  location: "Str. Ștefan cel Mare 1, ap. 2; et. 3",
  notes: "Bring the card\r\nBEGIN:VALARM\r\nTRIGGER:-PT5M",
  reminderMinutes: 15,
});
const ALL_DAY = record({
  id: 2,
  title: "Trip",
  allDay: true,
  start: "2026-10-23",
  end: "2026-10-26",
  reminderMinutes: 900,
});
const ALL_DAY_SERIES = record({
  id: 4,
  title: "Market",
  allDay: true,
  start: "2026-10-03",
  end: "2026-10-04",
  rrule: "FREQ=WEEKLY;BYDAY=SA;UNTIL=20261231",
  exdates: ["2026-10-17"],
  tzid: "America/New_York",
});
const ALL_DAY_EXCEPTION = record({
  id: 5,
  title: "Market (late)",
  allDay: true,
  start: "2026-10-25",
  end: "2026-10-26",
  seriesId: 4,
  originalStart: "2026-10-24",
});

const unfold = (text: string) => text.replace(/\r\n[ \t]/g, "");

/** The `VEVENT`s, unfolded, as arrays of lines. */
function vevents(text: string): string[][] {
  const lines = unfold(text).split("\r\n");
  const found: string[][] = [];
  let current: string[] | undefined;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") current = [];
    else if (line === "END:VEVENT" && current) {
      found.push(current);
      current = undefined;
    } else current?.push(line);
  }
  return found;
}

const feed = (events: EventRecord[], timeZone = "Europe/Bucharest") => feedCalendar({ events, timeZone, now: NOW });

describe("feedCalendar", () => {
  it("is a calendar with its header, a VTIMEZONE per zone used, and CRLF after every line", () => {
    const text = feed([ONE_OFF, SERIES, EXCEPTION, ALL_DAY, ALL_DAY_SERIES, ALL_DAY_EXCEPTION]);
    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Almanac//Calendar feed//EN\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    for (const line of text.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    // The display zone, and no other: the only timed series is in it, and an all-day series has no zone.
    expect(unfold(text).match(/^TZID:.*$/gm)).toEqual(["TZID:Europe/Bucharest"]);
    expect(text).toContain("X-WR-TIMEZONE:Europe/Bucharest\r\n");
    expect(text).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n");
  });

  it("writes no alarm, whatever the events' reminders or text say", () => {
    const text = unfold(feed([ONE_OFF, SERIES, EXCEPTION, ALL_DAY]));
    expect(text).not.toMatch(/^BEGIN:VALARM/m);
    expect(text).not.toMatch(/^TRIGGER/m);
    expect(text).toContain("DESCRIPTION:Bring the card\\nBEGIN:VALARM\\nTRIGGER:-PT5M\r\n");
  });

  it("writes a timed one-off in UTC, with its text escaped", () => {
    const [event] = vevents(feed([ONE_OFF]));
    expect(event).toEqual([
      "UID:event-1-20261001T080000Z@almanac",
      "DTSTART:20261020T053000Z",
      "DTEND:20261020T063000Z",
      "DTSTAMP:20261002T093000Z",
      "CREATED:20261001T080000Z",
      "LAST-MODIFIED:20261002T093000Z",
      "SUMMARY:Dentist",
      "LOCATION:Str. Ștefan cel Mare 1\\, ap. 2\\; et. 3",
      "DESCRIPTION:Bring the card\\nBEGIN:VALARM\\nTRIGGER:-PT5M",
    ]);
  });

  it("writes an all-day event as dates, its end exclusive", () => {
    const [event] = vevents(feed([ALL_DAY]));
    expect(event).toContain("DTSTART;VALUE=DATE:20261023");
    expect(event).toContain("DTEND;VALUE=DATE:20261026");
  });

  it("writes a timed series in its zone, its deleted occurrences and its exception in the same form", () => {
    const [series, exception, ...rest] = vevents(feed([EXCEPTION, SERIES]));
    expect(rest).toEqual([]);
    expect(series).toEqual([
      "UID:event-3-20261001T080000Z@almanac",
      "DTSTART;TZID=Europe/Bucharest:20261005T093000",
      "DTEND;TZID=Europe/Bucharest:20261005T100000",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      "EXDATE;TZID=Europe/Bucharest:20261022T093000",
      // After the clocks go back, 09:30 in Bucharest is 07:30 UTC.
      "EXDATE;TZID=Europe/Bucharest:20261029T093000",
      "DTSTAMP:20261002T093000Z",
      "CREATED:20261001T080000Z",
      "LAST-MODIFIED:20261002T093000Z",
      "SUMMARY:Team standup",
    ]);
    expect(exception).toEqual([
      "UID:event-3-20261001T080000Z@almanac",
      "RECURRENCE-ID;TZID=Europe/Bucharest:20261021T093000",
      "DTSTART:20261021T080000Z",
      "DTEND:20261021T083000Z",
      "DTSTAMP:20261003T100000Z",
      "CREATED:20261003T100000Z",
      "LAST-MODIFIED:20261003T100000Z",
      "SUMMARY:Standup\\, moved",
    ]);
  });

  it("writes an all-day series and its exception by date", () => {
    const [series, exception] = vevents(feed([ALL_DAY_SERIES, ALL_DAY_EXCEPTION]));
    expect(series).toContain("DTSTART;VALUE=DATE:20261003");
    expect(series).toContain("RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=20261231");
    expect(series).toContain("EXDATE;VALUE=DATE:20261017");
    expect(exception).toContain("RECURRENCE-ID;VALUE=DATE:20261024");
    expect(exception).toContain("UID:event-4-20261001T080000Z@almanac");
  });

  it("writes an exception whose series isn't there as an event of its own", () => {
    const [event] = vevents(feed([EXCEPTION]));
    expect(event?.[0]).toBe("UID:event-9-20261003T100000Z@almanac");
    expect(event?.some((line) => line.startsWith("RECURRENCE-ID"))).toBe(false);
  });

  it("gives the same bytes for the same rows, in any order, and a UID that follows the row", () => {
    const rows = [ONE_OFF, SERIES, EXCEPTION, ALL_DAY];
    expect(feed([...rows].reverse())).toBe(feed(rows));
    const renamed: EventRecord = { ...ONE_OFF, title: "Renamed", updatedAt: "2026-11-01T00:00:00.000Z" };
    expect(uidOf(renamed)).toBe(uidOf(ONE_OFF));
    // An id SQLite hands out again after the newest row went is another event.
    expect(uidOf({ ...ONE_OFF, createdAt: "2026-11-01T00:00:00.000Z" })).not.toBe(uidOf(ONE_OFF));
  });

  it("holds the display zone's VTIMEZONE when there are no events, so the calendar is never empty", () => {
    const text = unfold(feed([], "Asia/Tokyo"));
    expect(text).toContain("BEGIN:VTIMEZONE\r\nTZID:Asia/Tokyo\r\n");
    expect(text).not.toContain("BEGIN:VEVENT");
  });

  it("folds a long title by octets, and unfolding gives it back", () => {
    const title =
      "Ședință de planificare, trimestrul IV; bugetul și echipa — împreună cu toți colegii din București 👋";
    const text = feed([{ ...ONE_OFF, title, location: "", notes: "" }]);
    const summary = unfold(text)
      .split("\r\n")
      .find((line) => line.startsWith("SUMMARY:"));
    expect(summary).toBe(`SUMMARY:${title.replaceAll(",", "\\,").replaceAll(";", "\\;")}`);
    expect(text.split("\r\n").filter((line) => line.startsWith(" ")).length).toBeGreaterThan(0);
  });
});
