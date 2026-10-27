import { addDays, calendarListSchema, occurrenceSchema, searchResponseSchema, type Occurrence } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databasePath, openDb } from "../db/open.js";
import { createEventStore } from "../store/events.js";
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

async function create(fields: object): Promise<Occurrence> {
  const payload = { calendarId, allDay: false, start: "2026-10-16T07:00:00Z", end: "2026-10-16T08:00:00Z", ...fields };
  const res = await t.inject({ method: "POST", url: "/api/events", payload });
  expect(res.statusCode).toBe(201);
  return occurrenceSchema.parse(res.json());
}

async function search(q: string, inject = t.inject): Promise<Occurrence[]> {
  const res = await inject({ method: "GET", url: `/api/search?q=${encodeURIComponent(q)}` });
  expect(res.statusCode).toBe(200);
  return searchResponseSchema.parse(res.json()).results;
}

const titles = (list: Occurrence[]) => list.map((occurrence) => occurrence.title);

describe("GET /api/search", () => {
  it("answers 401 without a session", async () => {
    expect((await t.app.inject({ method: "GET", url: "/api/search?q=x" })).statusCode).toBe(401);
  });

  it("finds events by title, location or notes, folding case and diacritics", async () => {
    await create({ title: "Ședință de catedră" });
    await create({ title: "Lunch", location: "Sala Ședință, etaj 2" });
    await create({ title: "Gym", notes: "după ȘEDINȚĂ" });
    await create({ title: "Dentist" });
    expect(titles(await search("sedinta"))).toEqual(["Ședință de catedră", "Lunch", "Gym"]);
    expect(titles(await search("  CATEDRA "))).toEqual(["Ședință de catedră"]);
    expect(await search("nothing like it")).toEqual([]);
  });

  it("orders by start in the display time zone", async () => {
    await create({ title: "Meet late", start: "2026-10-20T15:00:00Z", end: "2026-10-20T16:00:00Z" });
    await create({ title: "Meet day", allDay: true, start: "2026-10-18", end: "2026-10-19" });
    await create({ title: "Meet early", start: "2026-10-18T05:00:00Z", end: "2026-10-18T06:00:00Z" });
    await create({ title: "Meet first", start: "2026-10-01T05:00:00Z", end: "2026-10-01T06:00:00Z" });
    expect(titles(await search("meet"))).toEqual(["Meet first", "Meet day", "Meet early", "Meet late"]);
  });

  /** One-day all-day events, `count` in a row from `first`, stored on a second connection. */
  function addRun(title: string, first: string, count: number): void {
    const db = openDb(databasePath(t.dataDir));
    try {
      const userId = (db.prepare("SELECT id FROM auth_users WHERE username = 'owner'").get() as { id: string }).id;
      const events = createEventStore(db);
      db.transaction(() => {
        for (let i = 0; i < count; i++) {
          const start = addDays(first, i);
          events.create(userId, { calendarId, title, location: "", notes: "", allDay: true, start, end: addDays(start, 1), reminderMinutes: null, tzid: "Europe/Bucharest" });
        }
      })();
    } finally {
      db.close();
    }
  }

  const run = (first: string, count: number) => Array.from({ length: count }, (_, i) => addDays(first, i));

  // Long past and far ahead: whatever day the tests run, the first are over and the rest to come.
  it("answers the 50 upcoming ones closest to now when there are more, by date", async () => {
    addRun("Run past", "2020-01-01", 5);
    addRun("Run ahead", "2040-01-01", 60);
    expect((await search("run")).map((o) => o.start)).toEqual(run("2040-01-01", 50));
  });

  it("fills up to 50 with the latest past ones, by date", async () => {
    addRun("Run past", "2020-01-01", 40);
    addRun("Run ahead", "2040-01-01", 30);
    expect((await search("run")).map((o) => o.start)).toEqual([...run("2020-01-21", 20), ...run("2040-01-01", 30)]);
  });

  it("skips a row it can't place, and answers the rest", async () => {
    await create({ title: "Run" });
    const db = openDb(databasePath(t.dataDir));
    try {
      const userId = (db.prepare("SELECT id FROM auth_users WHERE username = 'owner'").get() as { id: string }).id;
      // All-day to the year 9999, daily: no write takes it now (EVENT_LENGTH_MAX_DAYS), but a row from before may be there.
      createEventStore(db).create(userId, {
        calendarId,
        title: "Run forever",
        location: "",
        notes: "",
        allDay: true,
        start: "2026-10-01",
        end: "9999-12-31",
        reminderMinutes: null,
        tzid: "Europe/Bucharest",
        rrule: "FREQ=DAILY",
      });
    } finally {
      db.close();
    }
    expect(titles(await search("run"))).toEqual(["Run"]);
  });

  it("refuses an empty or long query with 400 validation", async () => {
    for (const url of ["/api/search", "/api/search?q=", "/api/search?q=%20%20", `/api/search?q=${"x".repeat(101)}`]) {
      const res = await t.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(400);
      expect((res.json() as { error: { code: string } }).error.code).toBe("validation");
    }
  });

  it("shows another user none of the first user's events", async () => {
    await create({ title: "Ședință" });
    const other = await t.signInAs("other");
    expect(await search("sedinta", other.inject)).toEqual([]);
    expect(titles(await search("sedinta"))).toEqual(["Ședință"]);
  });
});

describe("GET /api/search for series", () => {
  const weekly = { freq: "weekly", end: { type: "never" } };
  /** Monday 5 January 2026, 10:00 in Bucharest: long before now, every week since. */
  const mondays = { title: "Standup", start: "2026-01-05T08:00:00Z", end: "2026-01-05T09:00:00Z", repeat: weekly };

  it("shows a series once, as its next occurrence", async () => {
    const series = await create(mondays);
    const results = await search("standup");
    expect(results).toHaveLength(1);
    const [next] = results;
    expect(next).toMatchObject({ eventId: series.eventId, seriesId: series.eventId, repeat: { freq: "weekly", byDay: ["MO"] } });
    expect(next?.id).toBe(`s${series.eventId}:${next?.originalStart}`);
    const start = Date.parse(next?.start ?? "");
    // The first Monday 10:00 that has not ended: within a week of now, still in its hour or after it.
    expect(Date.parse(next?.end ?? "")).toBeGreaterThan(Date.now() - 60_000);
    expect(start).toBeLessThan(Date.now() + 7 * 86_400_000);
    expect(new Date(start).getUTCDay()).toBe(1);
  });

  it("shows a series that is over as its last occurrence, and one not started as its first", async () => {
    await create({ title: "Course", start: "2020-03-02T08:00:00Z", end: "2020-03-02T09:00:00Z", repeat: { freq: "weekly", end: { type: "count", count: 3 } } });
    await create({ title: "Course later", start: "2099-03-02T08:00:00Z", end: "2099-03-02T09:00:00Z", repeat: weekly });
    expect((await search("course")).map((o) => o.start)).toEqual(["2020-03-16T08:00:00Z", "2099-03-02T08:00:00Z"]);
  });

  it("shows an exception whose text matches as itself, beside its series", async () => {
    const series = await create(mondays);
    const res = await t.inject({
      method: "PATCH",
      url: `/api/events/${series.eventId}`,
      payload: { scope: "this", occurrence: "2026-01-12T08:00:00Z", changes: { notes: "standup with the retro" } },
    });
    expect(res.statusCode).toBe(200);
    const exception = occurrenceSchema.parse(res.json());
    expect(titles(await search("retro"))).toEqual(["Standup"]);
    const both = await search("standup");
    expect(both).toHaveLength(2);
    expect(both[0]).toMatchObject({ id: exception.id, seriesId: series.eventId, start: "2026-01-12T08:00:00Z", repeat: { freq: "weekly" } });
    expect(both[1]?.id).toMatch(new RegExp(`^s${series.eventId}:`));
  });
});

