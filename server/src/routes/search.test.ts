import { calendarListSchema, searchResponseSchema, type Occurrence } from "@almanac/shared";
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

async function create(fields: object): Promise<void> {
  const payload = { calendarId, allDay: false, start: "2026-10-16T07:00:00Z", end: "2026-10-16T08:00:00Z", ...fields };
  const res = await t.inject({ method: "POST", url: "/api/events", payload });
  expect(res.statusCode).toBe(201);
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

  it("answers at most 50", async () => {
    const db = openDb(databasePath(t.dataDir));
    try {
      const userId = (db.prepare("SELECT id FROM auth_users WHERE username = 'owner'").get() as { id: string }).id;
      const events = createEventStore(db);
      db.transaction(() => {
        for (let i = 0; i < 60; i++) {
          const day = String(1 + (i % 28)).padStart(2, "0");
          events.create(userId, {
            calendarId,
            title: `Run ${i}`,
            location: "",
            notes: "",
            allDay: true,
            start: `2026-11-${day}`,
            end: `2026-11-${String(2 + (i % 28)).padStart(2, "0")}`,
            tzid: "Europe/Bucharest",
          });
        }
      })();
    } finally {
      db.close();
    }
    const results = await search("run");
    expect(results).toHaveLength(50);
    expect(results[0]?.start).toBe("2026-11-01");
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
