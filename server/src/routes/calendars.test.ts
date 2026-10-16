import {
  calendarListSchema,
  calendarSchema,
  occurrenceListSchema,
  occurrenceSchema,
  type Calendar,
  type Occurrence,
} from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databasePath, openDb } from "../db/open.js";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";

let t: SignedInTestApp;

beforeEach(async () => {
  t = await startSignedInApp();
});

afterEach(async () => {
  await t.close();
});

type Response = Awaited<ReturnType<SignedInTestApp["inject"]>>;

function expectError(res: Response, status: number, code: string): string {
  expect(res.statusCode).toBe(status);
  const body = res.json() as { error: { code: string; message: string } };
  expect(Object.keys(body)).toEqual(["error"]);
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe("string");
  return body.error.message;
}

async function list(inject = t.inject): Promise<Calendar[]> {
  const res = await inject({ method: "GET", url: "/api/calendars" });
  expect(res.statusCode).toBe(200);
  return calendarListSchema.parse(res.json()).calendars;
}

async function create(payload: object): Promise<Calendar> {
  const res = await t.inject({ method: "POST", url: "/api/calendars", payload });
  expect(res.statusCode).toBe(201);
  return calendarSchema.parse(res.json());
}

describe("without a session", () => {
  it("answers 401 on every calendar route", async () => {
    for (const [method, url] of [
      ["GET", "/api/calendars"],
      ["POST", "/api/calendars"],
      ["PATCH", "/api/calendars/1"],
      ["DELETE", "/api/calendars/1"],
    ] as const) {
      const res = await t.app.inject({ method, url, payload: method === "POST" || method === "PATCH" ? {} : undefined });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});

describe("GET /api/calendars", () => {
  it("gives a new user one calendar, Personal in blue, and only once", async () => {
    const first = await list();
    expect(first).toEqual([expect.objectContaining({ name: "Personal", color: "blue", visible: true, position: 0 })]);
    expect(await list()).toEqual(first);
  });

  it("lists by position", async () => {
    await list();
    await create({ name: "Work" });
    await create({ name: "Gym", color: "red" });
    expect((await list()).map((calendar) => [calendar.name, calendar.color])).toEqual([
      ["Personal", "blue"],
      ["Work", "teal"],
      ["Gym", "red"],
    ]);
  });
});

describe("POST /api/calendars", () => {
  it("refuses a bad body naming the field", async () => {
    expect(expectError(await t.inject({ method: "POST", url: "/api/calendars", payload: { name: "" } }), 400, "validation")).toMatch(
      /^name:/,
    );
    expect(
      expectError(await t.inject({ method: "POST", url: "/api/calendars", payload: { name: "Work", color: "beige" } }), 400, "validation"),
    ).toMatch(/^color:/);
  });
});

describe("PATCH /api/calendars/:id", () => {
  it("renames, recolours and hides", async () => {
    const work = await create({ name: "Work" });
    const res = await t.inject({ method: "PATCH", url: `/api/calendars/${work.id}`, payload: { name: "Job", color: "purple", visible: false } });
    expect(res.statusCode).toBe(200);
    expect(calendarSchema.parse(res.json())).toMatchObject({ id: work.id, name: "Job", color: "purple", visible: false });
  });

  it("answers 404 for a bad id or one that does not exist", async () => {
    expectError(await t.inject({ method: "PATCH", url: "/api/calendars/abc", payload: {} }), 404, "not_found");
    expectError(await t.inject({ method: "PATCH", url: "/api/calendars/999", payload: {} }), 404, "not_found");
  });
});

describe("DELETE /api/calendars/:id", () => {
  it("deletes a calendar and its events", async () => {
    const [personal] = await list();
    const work = await create({ name: "Work" });
    const event = await t.inject({
      method: "POST",
      url: "/api/events",
      payload: { calendarId: work.id, title: "Standup", allDay: false, start: "2026-10-16T07:00:00Z", end: "2026-10-16T07:15:00Z" },
    });
    expect(event.statusCode).toBe(201);
    const eventId = (event.json() as { eventId: number }).eventId;

    const res = await t.inject({ method: "DELETE", url: `/api/calendars/${work.id}` });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
    expect(await list()).toEqual([personal]);
    expectError(await t.inject({ method: "PATCH", url: `/api/events/${eventId}`, payload: { changes: { title: "x" } } }), 404, "not_found");
    const occurrences = await t.inject({ method: "GET", url: "/api/occurrences?from=2026-10-16T00:00:00Z&to=2026-10-17T00:00:00Z" });
    expect(occurrences.json()).toEqual({ occurrences: [] });
  });

  /** Weekly on Monday 10:00-11:00 in Bucharest from 5 October 2026, and its October keys. */
  const OCT = { 5: "2026-10-05T07:00:00Z", 12: "2026-10-12T07:00:00Z", 19: "2026-10-19T07:00:00Z", 26: "2026-10-26T08:00:00Z" };

  async function mondays(calendarId: number, end: object = { type: "never" }): Promise<Occurrence> {
    const res = await t.inject({
      method: "POST",
      url: "/api/events",
      payload: { calendarId, title: "Standup", allDay: false, start: OCT[5], end: "2026-10-05T08:00:00Z", repeat: { freq: "weekly", end } },
    });
    expect(res.statusCode, res.body).toBe(201);
    return occurrenceSchema.parse(res.json());
  }

  /** "This event" moved to another calendar: an exception there. */
  async function moveOne(seriesId: number, key: string, calendarId: number): Promise<Occurrence> {
    const res = await t.inject({ method: "PATCH", url: `/api/events/${seriesId}`, payload: { scope: "this", occurrence: key, changes: { calendarId } } });
    expect(res.statusCode, res.body).toBe(200);
    return occurrenceSchema.parse(res.json());
  }

  async function october(): Promise<Occurrence[]> {
    const res = await t.inject({ method: "GET", url: "/api/occurrences?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z" });
    expect(res.statusCode).toBe(200);
    return occurrenceListSchema.parse(res.json()).occurrences;
  }

  /** Every events row, read on a second connection. */
  function rows(): { id: number; calendar_id: number; series_id: number | null; original_start: string | null; exdates: string }[] {
    const db = openDb(databasePath(t.dataDir));
    try {
      return db.prepare("SELECT id, calendar_id, series_id, original_start, exdates FROM events ORDER BY id").all() as ReturnType<typeof rows>;
    } finally {
      db.close();
    }
  }

  it("keeps an occurrence moved out of the deleted calendar, as a one-off", async () => {
    const [personal] = await list();
    const work = await create({ name: "Work" });
    const series = await mondays(work.id);
    const moved = await moveOne(series.eventId, OCT[12], personal?.id ?? 0);

    expect((await t.inject({ method: "DELETE", url: `/api/calendars/${work.id}` })).statusCode).toBe(204);
    expect(await october()).toEqual([
      { ...moved, seriesId: null, originalStart: null, repeat: null },
    ]);
    expect(rows()).toEqual([{ id: moved.eventId, calendar_id: personal?.id, series_id: null, original_start: null, exdates: "[]" }]);
  });

  it("keeps an occurrence moved into the deleted calendar gone from its series", async () => {
    const [personal] = await list();
    const work = await create({ name: "Work" });
    const series = await mondays(personal?.id ?? 0);
    await moveOne(series.eventId, OCT[12], work.id);

    expect((await t.inject({ method: "DELETE", url: `/api/calendars/${work.id}` })).statusCode).toBe(204);
    expect((await october()).map((o) => o.start)).toEqual([OCT[5], OCT[19], OCT[26]]);
    expect(rows()).toMatchObject([{ id: series.eventId, exdates: JSON.stringify([OCT[12]]) }]);
  });

  it("deletes a series whose every occurrence was moved into the deleted calendar", async () => {
    const [personal] = await list();
    const work = await create({ name: "Work" });
    const series = await mondays(personal?.id ?? 0, { type: "count", count: 2 });
    await moveOne(series.eventId, OCT[5], work.id);
    await moveOne(series.eventId, OCT[12], work.id);

    expect((await t.inject({ method: "DELETE", url: `/api/calendars/${work.id}` })).statusCode).toBe(204);
    expect(rows()).toEqual([]);
  });

  it("refuses the last calendar with 409 conflict", async () => {
    const [personal] = await list();
    expectError(await t.inject({ method: "DELETE", url: `/api/calendars/${personal?.id}` }), 409, "conflict");
    expect(await list()).toEqual([personal]);
  });
});

describe("another user", () => {
  it("gets 404 on the first user's calendar and sees only their own", async () => {
    await list();
    const work = await create({ name: "Work" });
    const other = await t.signInAs("other");

    expectError(await other.inject({ method: "PATCH", url: `/api/calendars/${work.id}`, payload: { name: "Mine" } }), 404, "not_found");
    expectError(await other.inject({ method: "DELETE", url: `/api/calendars/${work.id}` }), 404, "not_found");
    const theirs = await list(other.inject);
    expect(theirs).toEqual([expect.objectContaining({ name: "Personal" })]);
    expect(theirs.some((calendar) => calendar.id === work.id)).toBe(false);
    expect((await list()).map((calendar) => calendar.name)).toEqual(["Personal", "Work"]);
  });
});
