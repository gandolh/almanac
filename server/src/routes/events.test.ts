import { calendarListSchema, occurrenceSchema, type Occurrence } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databasePath, openDb } from "../db/open.js";
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

type Response = Awaited<ReturnType<SignedInTestApp["inject"]>>;

function expectError(res: Response, status: number, code: string): string {
  expect(res.statusCode).toBe(status);
  const body = res.json() as { error: { code: string; message: string } };
  expect(body.error.code).toBe(code);
  return body.error.message;
}

const standup = () => ({
  calendarId,
  title: "Standup",
  allDay: false,
  start: "2026-10-16T10:00:00+03:00",
  end: "2026-10-16T10:15:00+03:00",
});

async function create(payload: object, inject = t.inject): Promise<Occurrence> {
  const res = await inject({ method: "POST", url: "/api/events", payload });
  expect(res.statusCode).toBe(201);
  return occurrenceSchema.parse(res.json());
}

/** The row as stored, read on a second connection. */
function storedRow(id: number) {
  const db = openDb(databasePath(t.dataDir));
  try {
    return db.prepare("SELECT tzid, rrule, start_at, start_date FROM events WHERE id = ?").get(id);
  } finally {
    db.close();
  }
}

describe("without a session", () => {
  it("answers 401 on every event route", async () => {
    for (const [method, url] of [
      ["POST", "/api/events"],
      ["PATCH", "/api/events/1"],
      ["DELETE", "/api/events/1"],
    ] as const) {
      const res = await t.app.inject({ method, url, payload: method === "DELETE" ? undefined : {} });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});

describe("POST /api/events", () => {
  it("creates a timed event and answers it as an occurrence in UTC with Z", async () => {
    const event = await create({ ...standup(), location: "Room 2", notes: "https://example.com/agenda" });
    expect(event).toEqual({
      id: `e${event.eventId}`,
      eventId: event.eventId,
      seriesId: null,
      originalStart: null,
      calendarId,
      title: "Standup",
      location: "Room 2",
      notes: "https://example.com/agenda",
      allDay: false,
      start: "2026-10-16T07:00:00Z",
      end: "2026-10-16T07:15:00Z",
      repeat: null,
    });
  });

  it("creates an all-day event over dates, the end exclusive", async () => {
    const event = await create({ calendarId, title: "Trip", allDay: true, start: "2026-10-16", end: "2026-10-19" });
    expect(event).toMatchObject({ allDay: true, start: "2026-10-16", end: "2026-10-19" });
  });

  it("stores the user's display time zone as the row's tzid", async () => {
    const first = await create(standup());
    expect(storedRow(first.eventId)).toMatchObject({ tzid: "Europe/Bucharest", rrule: null });
    await t.inject({ method: "PATCH", url: "/api/settings", payload: { timeZone: "America/New_York" } });
    const second = await create(standup());
    expect(storedRow(second.eventId)).toMatchObject({ tzid: "America/New_York" });
  });

  it("refuses a repeat until brief 04 with 400 validation", async () => {
    const repeat = { freq: "daily", end: { type: "never" } };
    expect(expectError(await t.inject({ method: "POST", url: "/api/events", payload: { ...standup(), repeat } }), 400, "validation")).toMatch(
      /^repeat:/,
    );
    expect((await create({ ...standup(), repeat: null })).repeat).toBeNull();
  });

  it("refuses a bad body naming the field", async () => {
    const bad = async (payload: object) =>
      expectError(await t.inject({ method: "POST", url: "/api/events", payload }), 400, "validation");
    expect(await bad({ ...standup(), title: "" })).toMatch(/^title:/);
    expect(await bad({ ...standup(), end: "2026-10-16T09:00:00+03:00" })).toBe("end: must be after the start");
    expect(await bad({ ...standup(), allDay: true })).toMatch(/^start: must be a date/);
    expect(await bad({ ...standup(), start: "2026-10-16T10:00:00" })).toMatch(/^start:/);
  });

  it("answers 404 for a calendar that is not the user's", async () => {
    const other = await t.signInAs("other");
    expectError(await other.inject({ method: "POST", url: "/api/events", payload: standup() }), 404, "not_found");
    expectError(await t.inject({ method: "POST", url: "/api/events", payload: { ...standup(), calendarId: 999 } }), 404, "not_found");
  });
});

describe("PATCH /api/events/:id", () => {
  it("changes what is given, checked against what is stored", async () => {
    const event = await create(standup());
    const res = await t.inject({
      method: "PATCH",
      url: `/api/events/${event.eventId}`,
      payload: { changes: { title: "Daily", end: "2026-10-16T08:00:00Z" } },
    });
    expect(res.statusCode).toBe(200);
    expect(occurrenceSchema.parse(res.json())).toEqual({ ...event, title: "Daily", end: "2026-10-16T08:00:00Z" });

    const backwards = await t.inject({
      method: "PATCH",
      url: `/api/events/${event.eventId}`,
      payload: { changes: { end: "2026-10-16T06:00:00Z" } },
    });
    expect(expectError(backwards, 400, "validation")).toBe("end: must be after the start");
  });

  it("turns a timed event all-day, and needs dates to do it", async () => {
    const event = await create(standup());
    const url = `/api/events/${event.eventId}`;
    expectError(await t.inject({ method: "PATCH", url, payload: { changes: { allDay: true } } }), 400, "validation");
    const res = await t.inject({ method: "PATCH", url, payload: { changes: { allDay: true, start: "2026-10-16", end: "2026-10-17" } } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ allDay: true, start: "2026-10-16", end: "2026-10-17" });
    expect(storedRow(event.eventId)).toMatchObject({ start_at: null, start_date: "2026-10-16" });
  });

  it("moves an event to another of the user's calendars, never to someone else's", async () => {
    const event = await create(standup());
    const work = await t.inject({ method: "POST", url: "/api/calendars", payload: { name: "Work" } });
    const workId = (work.json() as { id: number }).id;
    const moved = await t.inject({ method: "PATCH", url: `/api/events/${event.eventId}`, payload: { changes: { calendarId: workId } } });
    expect(moved.json()).toMatchObject({ calendarId: workId });

    const other = await t.signInAs("other");
    const theirs = calendarListSchema.parse((await other.inject({ method: "GET", url: "/api/calendars" })).json()).calendars[0];
    expectError(
      await t.inject({ method: "PATCH", url: `/api/events/${event.eventId}`, payload: { changes: { calendarId: theirs?.id } } }),
      404,
      "not_found",
    );
  });

  it("accepts a scope and an occurrence key, which a one-off ignores, and checks their shape", async () => {
    const event = await create(standup());
    const url = `/api/events/${event.eventId}`;
    const ok = await t.inject({ method: "PATCH", url, payload: { scope: "all", occurrence: event.start, changes: { title: "X" } } });
    expect(ok.statusCode).toBe(200);
    expectError(await t.inject({ method: "PATCH", url, payload: { scope: "every", changes: {} } }), 400, "validation");
    expectError(await t.inject({ method: "PATCH", url, payload: { title: "no changes wrapper" } }), 400, "validation");
    expectError(
      await t.inject({ method: "PATCH", url, payload: { changes: { repeat: { freq: "daily", end: { type: "never" } } } } }),
      400,
      "validation",
    );
  });

  it("answers 404 for a bad id or one that does not exist", async () => {
    expectError(await t.inject({ method: "PATCH", url: "/api/events/abc", payload: { changes: {} } }), 404, "not_found");
    expectError(await t.inject({ method: "PATCH", url: "/api/events/999", payload: { changes: {} } }), 404, "not_found");
  });
});

describe("DELETE /api/events/:id", () => {
  it("deletes the event", async () => {
    const event = await create(standup());
    const res = await t.inject({ method: "DELETE", url: `/api/events/${event.eventId}?scope=this&occurrence=${event.start}` });
    expect(res.statusCode).toBe(204);
    expectError(await t.inject({ method: "DELETE", url: `/api/events/${event.eventId}` }), 404, "not_found");
  });

  it("checks the query's shape", async () => {
    const event = await create(standup());
    expectError(await t.inject({ method: "DELETE", url: `/api/events/${event.eventId}?scope=some` }), 400, "validation");
    expectError(await t.inject({ method: "DELETE", url: `/api/events/${event.eventId}?occurrence=soon` }), 400, "validation");
  });
});

describe("another user", () => {
  it("gets 404 on the first user's event and cannot change or delete it", async () => {
    const event = await create(standup());
    const other = await t.signInAs("other");
    const url = `/api/events/${event.eventId}`;
    expectError(await other.inject({ method: "PATCH", url, payload: { changes: { title: "Mine" } } }), 404, "not_found");
    expectError(await other.inject({ method: "DELETE", url }), 404, "not_found");
    const still = await t.inject({ method: "PATCH", url, payload: { changes: {} } });
    expect(still.json()).toEqual(event);
  });
});
