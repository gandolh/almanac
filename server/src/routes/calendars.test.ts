import { calendarListSchema, calendarSchema, type Calendar } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
