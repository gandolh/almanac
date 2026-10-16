import { calendarListSchema, occurrenceListSchema, occurrenceSchema, type Occurrence } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databasePath, openDb } from "../db/open.js";
import { createEventStore, type NewEvent } from "../store/events.js";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";

let t: SignedInTestApp;
let calendarId: number;

beforeEach(async () => {
  t = await startSignedInApp();
  const res = await t.inject({ method: "GET", url: "/api/calendars" });
  calendarId = calendarListSchema.parse(res.json()).calendars[0]?.id ?? 0;
});

afterEach(async () => {
  await t.close();
});

async function create(payload: object, inject = t.inject): Promise<Occurrence> {
  const res = await inject({ method: "POST", url: "/api/events", payload });
  expect(res.statusCode).toBe(201);
  return occurrenceSchema.parse(res.json());
}

const timed = (title: string, start: string, end: string) => ({ calendarId, title, allDay: false, start, end });
const allDay = (title: string, start: string, end: string) => ({ calendarId, title, allDay: true, start, end });

async function occurrences(from: string, to: string, inject = t.inject): Promise<Occurrence[]> {
  const res = await inject({ method: "GET", url: `/api/occurrences?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` });
  expect(res.statusCode).toBe(200);
  return occurrenceListSchema.parse(res.json()).occurrences;
}

const titles = (list: Occurrence[]) => list.map((occurrence) => occurrence.title);

/** Stores a row as it is, past the API's checks, on a second connection. */
function insertRow(event: NewEvent): void {
  const db = openDb(databasePath(t.dataDir));
  try {
    const userId = (db.prepare("SELECT id FROM auth_users WHERE username = 'owner'").get() as { id: string }).id;
    createEventStore(db).create(userId, event);
  } finally {
    db.close();
  }
}

/** 16 October 2026 in Bucharest (UTC+3), midnight to midnight. */
const DAY = ["2026-10-16T00:00:00+03:00", "2026-10-17T00:00:00+03:00"] as const;

describe("GET /api/occurrences", () => {
  it("answers 401 without a session", async () => {
    const res = await t.app.inject({ method: "GET", url: `/api/occurrences?from=${DAY[0]}&to=${DAY[1]}` });
    expect(res.statusCode).toBe(401);
  });

  it("answers the one-off events overlapping the range, timed ones in UTC with Z", async () => {
    await create(timed("Late", "2026-10-15T23:00:00+03:00", "2026-10-16T00:00:00+03:00"));
    await create(timed("Across midnight", "2026-10-15T23:30:00+03:00", "2026-10-16T00:30:00+03:00"));
    await create(timed("Standup", "2026-10-16T10:00:00+03:00", "2026-10-16T10:15:00+03:00"));
    await create(timed("Tomorrow", "2026-10-17T00:00:00+03:00", "2026-10-17T01:00:00+03:00"));
    const found = await occurrences(...DAY);
    expect(titles(found)).toEqual(["Across midnight", "Standup"]);
    expect(found[1]).toMatchObject({ start: "2026-10-16T07:00:00Z", end: "2026-10-16T07:15:00Z" });
  });

  it("matches all-day events on the dates the range covers in the display time zone", async () => {
    await create(allDay("The 15th", "2026-10-15", "2026-10-16"));
    await create(allDay("The 16th", "2026-10-16", "2026-10-17"));
    await create(allDay("Three days", "2026-10-14", "2026-10-17"));
    await create(allDay("The 17th", "2026-10-17", "2026-10-18"));
    expect(titles(await occurrences(...DAY))).toEqual(["Three days", "The 16th"]);
    // The same instants are 15 Oct 21:00 to 16 Oct 21:00 in UTC: two days there.
    await t.inject({ method: "PATCH", url: "/api/settings", payload: { timeZone: "UTC" } });
    expect(titles(await occurrences(...DAY))).toEqual(["Three days", "The 15th", "The 16th"]);
  });

  it("spans an all-day event over every day it covers, and no further", async () => {
    await create(allDay("Trip", "2026-10-16", "2026-10-19"));
    const day = (date: string) => occurrences(`${date}T00:00:00+03:00`, `${date}T23:59:59+03:00`);
    expect(titles(await day("2026-10-15"))).toEqual([]);
    for (const date of ["2026-10-16", "2026-10-17", "2026-10-18"]) expect(titles(await day(date)), date).toEqual(["Trip"]);
    expect(titles(await day("2026-10-19"))).toEqual([]);
  });

  it("orders by start in the display time zone, all-day first on a day", async () => {
    await create(timed("Ten", "2026-10-16T10:00:00+03:00", "2026-10-16T11:00:00+03:00"));
    await create(allDay("Holiday", "2026-10-16", "2026-10-17"));
    await create(timed("Half past one", "2026-10-16T01:30:00+03:00", "2026-10-16T02:00:00+03:00"));
    await create(allDay("Yesterday", "2026-10-15", "2026-10-16"));
    const week = await occurrences("2026-10-12T00:00:00+03:00", "2026-10-19T00:00:00+03:00");
    expect(titles(week)).toEqual(["Yesterday", "Holiday", "Half past one", "Ten"]);
  });

  it("refuses a bad range with 400 validation", async () => {
    const bad = async (query: string) => {
      const res = await t.inject({ method: "GET", url: `/api/occurrences?${query}` });
      expect(res.statusCode, query).toBe(400);
      return (res.json() as { error: { code: string; message: string } }).error;
    };
    expect(await bad("from=2026-10-16T00:00:00Z")).toMatchObject({ code: "validation" });
    expect(await bad("from=2026-10-16&to=2026-10-17")).toMatchObject({ code: "validation" });
    expect((await bad("from=2026-10-17T00:00:00Z&to=2026-10-16T00:00:00Z")).message).toBe("to: must be after from");
    expect((await bad("from=2026-01-01T00:00:00Z&to=2027-03-01T00:00:00Z")).message).toBe(
      "to: must be at most 400 days after from",
    );
  });

  it("takes a year's range, as the year view asks", async () => {
    await create(allDay("New year", "2026-01-01", "2026-01-02"));
    expect(titles(await occurrences("2026-01-01T00:00:00+02:00", "2027-01-01T00:00:00+02:00"))).toEqual(["New year"]);
  });

  it("shows another user none of the first user's occurrences", async () => {
    await create(timed("Standup", "2026-10-16T10:00:00+03:00", "2026-10-16T10:15:00+03:00"));
    await create(allDay("Holiday", "2026-10-16", "2026-10-17"));
    const other = await t.signInAs("other");
    expect(await occurrences(...DAY, other.inject)).toEqual([]);
    expect(titles(await occurrences(...DAY))).toEqual(["Holiday", "Standup"]);
  });
});

describe("GET /api/occurrences for series", () => {
  const weekly = { freq: "weekly", end: { type: "never" } };
  const october = ["2026-10-01T00:00:00+03:00", "2026-11-01T00:00:00+02:00"] as const;
  const november = ["2026-11-01T00:00:00+02:00", "2026-12-01T00:00:00+02:00"] as const;

  async function patch(id: number, payload: object): Promise<Occurrence> {
    const res = await t.inject({ method: "PATCH", url: `/api/events/${id}`, payload });
    expect(res.statusCode, res.body).toBe(200);
    return occurrenceSchema.parse(res.json());
  }

  it("keeps a weekly Monday 10:00 Bucharest series at 10:00 local across the end of summer time", async () => {
    const series = await create({ ...timed("Standup", "2026-10-19T10:00:00+03:00", "2026-10-19T11:00:00+03:00"), repeat: weekly });
    expect(await occurrences(...october)).toEqual([
      {
        id: `s${series.eventId}:2026-10-19T07:00:00Z`,
        eventId: series.eventId,
        seriesId: series.eventId,
        originalStart: "2026-10-19T07:00:00Z",
        calendarId,
        title: "Standup",
        location: "",
        notes: "",
        allDay: false,
        start: "2026-10-19T07:00:00Z",
        end: "2026-10-19T08:00:00Z",
        repeat: { freq: "weekly", byDay: ["MO"], end: { type: "never" } },
      },
      expect.objectContaining({
        id: `s${series.eventId}:2026-10-26T08:00:00Z`,
        start: "2026-10-26T08:00:00Z",
        end: "2026-10-26T09:00:00Z",
      }),
    ]);
  });

  it("puts one-offs, generated occurrences and exceptions together by start", async () => {
    const series = await create({ ...timed("Standup", "2026-10-19T10:00:00+03:00", "2026-10-19T11:00:00+03:00"), repeat: weekly });
    await create(timed("Dentist", "2026-10-20T09:00:00+03:00", "2026-10-20T10:00:00+03:00"));
    await create({ ...allDay("Gym", "2026-10-21", "2026-10-22"), repeat: { freq: "daily", end: { type: "count", count: 2 } } });
    const moved = await patch(series.eventId, {
      scope: "this",
      occurrence: "2026-10-19T07:00:00Z",
      changes: { title: "Planning", start: "2026-10-21T12:00:00+03:00", end: "2026-10-21T13:00:00+03:00" },
    });
    const found = await occurrences("2026-10-19T00:00:00+03:00", "2026-10-26T00:00:00+02:00");
    expect(titles(found)).toEqual(["Dentist", "Gym", "Planning", "Gym"]);
    expect(found[2]).toEqual({ ...moved, repeat: { freq: "weekly", byDay: ["MO"], end: { type: "never" } } });
    expect(found[2]).toMatchObject({ id: `e${moved.eventId}`, seriesId: series.eventId, originalStart: "2026-10-19T07:00:00Z" });
    expect(found[1]).toMatchObject({ allDay: true, start: "2026-10-21", end: "2026-10-22", repeat: { freq: "daily" } });
  });

  it("shows a moved exception where it went, inside or outside the range", async () => {
    const series = await create({ ...timed("Standup", "2026-10-05T10:00:00+03:00", "2026-10-05T11:00:00+03:00"), repeat: weekly });
    // 12 October moved out to 20 November; 2 November moved in to 30 October.
    await patch(series.eventId, {
      scope: "this",
      occurrence: "2026-10-12T07:00:00Z",
      changes: { title: "Out", start: "2026-11-20T10:00:00+02:00", end: "2026-11-20T11:00:00+02:00" },
    });
    await patch(series.eventId, {
      scope: "this",
      occurrence: "2026-11-02T08:00:00Z",
      changes: { title: "In", start: "2026-10-30T10:00:00+02:00", end: "2026-10-30T11:00:00+02:00" },
    });
    const inOctober = await occurrences(...october);
    expect(inOctober.map((o) => `${o.start.slice(5, 10)} ${o.title}`)).toEqual([
      "10-05 Standup",
      "10-19 Standup",
      "10-26 Standup",
      "10-30 In",
    ]);
    const inNovember = await occurrences(...november);
    expect(inNovember.map((o) => `${o.start.slice(5, 10)} ${o.title}`)).toEqual([
      "11-09 Standup",
      "11-16 Standup",
      "11-20 Out",
      "11-23 Standup",
      "11-30 Standup",
    ]);
  });

  it("shows an exception moved before its series starts, in a range the series does not reach", async () => {
    const series = await create({ ...timed("Standup", "2026-11-02T10:00:00+02:00", "2026-11-02T11:00:00+02:00"), repeat: weekly });
    await patch(series.eventId, {
      scope: "this",
      occurrence: "2026-11-02T08:00:00Z",
      changes: { start: "2026-10-30T10:00:00+02:00", end: "2026-10-30T11:00:00+02:00" },
    });
    expect(await occurrences(...october)).toMatchObject([
      { title: "Standup", start: "2026-10-30T08:00:00Z", seriesId: series.eventId, repeat: { freq: "weekly", byDay: ["MO"] } },
    ]);
  });

  it("includes an occurrence that started before the range and is still going", async () => {
    await create({ ...timed("Night shift", "2026-10-15T22:00:00+03:00", "2026-10-16T06:00:00+03:00"), repeat: { freq: "daily", end: { type: "never" } } });
    expect((await occurrences(...DAY)).map((o) => o.start)).toEqual(["2026-10-15T19:00:00Z", "2026-10-16T19:00:00Z"]);
  });

  it("skips a series that will not expand, and answers the rest", async () => {
    await create({ ...timed("Standup", "2026-10-05T10:00:00+03:00", "2026-10-05T11:00:00+03:00"), repeat: weekly });
    await create(timed("Dentist", "2026-10-20T09:00:00+03:00", "2026-10-20T10:00:00+03:00"));
    // All-day to the year 9999: no write takes it now (EVENT_LENGTH_MAX_DAYS), but a row from before may be there.
    insertRow({ calendarId, title: "Forever", location: "", notes: "", allDay: true, start: "2026-10-01", end: "9999-12-31", tzid: "Europe/Bucharest", rrule: "FREQ=DAILY" });
    expect(titles(await occurrences(...october))).toEqual(["Standup", "Standup", "Standup", "Dentist", "Standup"]);
  });

  it("shows another user none of the first user's series", async () => {
    await create({ ...timed("Standup", "2026-10-05T10:00:00+03:00", "2026-10-05T11:00:00+03:00"), repeat: weekly });
    const other = await t.signInAs("other");
    expect(await occurrences(...october, other.inject)).toEqual([]);
    expect(await occurrences(...october)).toHaveLength(4);
  });
});
