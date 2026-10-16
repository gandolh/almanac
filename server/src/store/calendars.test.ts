import { calendarSchema } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { ApiError } from "../errors.js";
import { createCalendarStore, type CalendarStore } from "./calendars.js";
import { createEventStore } from "./events.js";

let db: Db;
let store: CalendarStore;
let tick: number;

/** One second later on every call, so `updatedAt` visibly moves. */
const clock = () => new Date(Date.UTC(2026, 9, 16, 9, 0, tick++));

/** A user row as the auth library keeps it (no password: these tests never sign in). */
function addUser(name: string): string {
  db.prepare(
    `INSERT INTO auth_users (id, username, username_folded, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'user', 0, 0)`,
  ).run(`id-${name}`, name, name);
  return `id-${name}`;
}

let ana: string;
let ion: string;

beforeEach(() => {
  tick = 0;
  db = openDb(":memory:");
  store = createCalendarStore(db, clock);
  ana = addUser("ana");
  ion = addUser("ion");
});

afterEach(() => {
  db.close();
});

describe("create and list", () => {
  it("creates a calendar last, with the next free colour, both times set", () => {
    const work = store.create(ana, { name: "Work" });
    expect(calendarSchema.parse(work)).toEqual(work);
    expect(work).toEqual({
      id: 1,
      name: "Work",
      color: "blue",
      visible: true,
      position: 0,
      createdAt: "2026-10-16T09:00:00.000Z",
      updatedAt: "2026-10-16T09:00:00.000Z",
    });
    const gym = store.create(ana, { name: "Gym", visible: false });
    expect(gym).toMatchObject({ color: "teal", visible: false, position: 1 });
    expect(store.create(ana, { name: "Uni", color: "red" })).toMatchObject({ color: "red", position: 2 });
    expect(store.list(ana).map((calendar) => calendar.name)).toEqual(["Work", "Gym", "Uni"]);
  });

  it("keeps each user's calendars, positions and colours apart", () => {
    store.create(ana, { name: "Work" });
    const theirs = store.create(ion, { name: "Home" });
    expect(theirs).toMatchObject({ color: "blue", position: 0 });
    expect(store.list(ion)).toEqual([theirs]);
    expect(store.get(ion, 1)).toBeUndefined();
  });

  it("refuses a user who does not exist (the foreign key is live)", () => {
    expect(() => store.create("nobody", { name: "Ghost" })).toThrow(/FOREIGN KEY/);
  });
});

describe("ensureDefault", () => {
  it("creates Personal in blue for a user with none, once", () => {
    expect(store.ensureDefault(ana)).toBe(true);
    expect(store.ensureDefault(ana)).toBe(false);
    expect(store.list(ana)).toEqual([expect.objectContaining({ name: "Personal", color: "blue", visible: true })]);
  });

  it("leaves a user with calendars alone", () => {
    store.create(ana, { name: "Work", color: "green" });
    expect(store.ensureDefault(ana)).toBe(false);
    expect(store.list(ana).map((calendar) => calendar.name)).toEqual(["Work"]);
  });
});

describe("update", () => {
  it("changes what is given and moves updatedAt", () => {
    const work = store.create(ana, { name: "Work" });
    const changed = store.update(ana, work.id, { name: "Job", visible: false });
    expect(changed).toEqual({ ...work, name: "Job", visible: false, updatedAt: "2026-10-16T09:00:01.000Z" });
    expect(store.update(ana, work.id, { color: "purple" })).toMatchObject({ name: "Job", color: "purple", visible: false });
  });

  it("leaves the row as it is for an empty patch", () => {
    const work = store.create(ana, { name: "Work" });
    expect(store.update(ana, work.id, {})).toEqual(work);
  });

  it("answers undefined for another user's calendar and leaves it alone", () => {
    const work = store.create(ana, { name: "Work" });
    expect(store.update(ion, work.id, { name: "Mine now" })).toBeUndefined();
    expect(store.get(ana, work.id)?.name).toBe("Work");
  });
});

describe("remove", () => {
  it("deletes a calendar with its events", () => {
    const events = createEventStore(db, clock);
    const work = store.create(ana, { name: "Work" });
    const home = store.create(ana, { name: "Home" });
    const content = { title: "x", location: "", notes: "", allDay: true, start: "2026-10-16", end: "2026-10-17" };
    const gone = events.create(ana, { ...content, calendarId: work.id, tzid: "Europe/Bucharest" });
    const kept = events.create(ana, { ...content, calendarId: home.id, tzid: "Europe/Bucharest" });
    expect(store.remove(ana, work.id)).toBe(true);
    expect(store.list(ana)).toEqual([home]);
    expect(events.get(ana, gone.id)).toBeUndefined();
    expect(events.get(ana, kept.id)).toEqual(kept);
  });

  it("refuses the user's last calendar with a conflict", () => {
    const only = store.create(ana, { name: "Work" });
    store.create(ion, { name: "Home" });
    let thrown: unknown;
    try {
      store.remove(ana, only.id);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).code).toBe("conflict");
    expect(store.list(ana)).toEqual([only]);
  });

  it("answers false for another user's calendar or none", () => {
    const work = store.create(ana, { name: "Work" });
    store.create(ana, { name: "Home" });
    expect(store.remove(ion, work.id)).toBe(false);
    expect(store.remove(ana, 999)).toBe(false);
    expect(store.list(ana)).toHaveLength(2);
  });
});
