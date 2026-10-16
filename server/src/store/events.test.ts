import { allDayRange } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { ApiError } from "../errors.js";
import { createCalendarStore } from "./calendars.js";
import { createEventStore, type EventContent, type EventRange, type EventStore } from "./events.js";

let db: Db;
let store: EventStore;
let tick: number;

const clock = () => new Date(Date.UTC(2026, 9, 16, 9, 0, tick++));
const ZONE = "Europe/Bucharest";

function addUser(name: string): string {
  db.prepare(
    `INSERT INTO auth_users (id, username, username_folded, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'user', 0, 0)`,
  ).run(`id-${name}`, name, name);
  return `id-${name}`;
}

let ana: string;
let ion: string;
let work: number;
let theirs: number;

beforeEach(() => {
  tick = 0;
  db = openDb(":memory:");
  store = createEventStore(db, clock);
  ana = addUser("ana");
  ion = addUser("ion");
  const calendars = createCalendarStore(db, clock);
  work = calendars.create(ana, { name: "Work" }).id;
  theirs = calendars.create(ion, { name: "Home" }).id;
  tick = 0;
});

afterEach(() => {
  db.close();
});

function timed(start: string, end: string, fields: Partial<EventContent> = {}): EventContent {
  return { calendarId: work, title: "Meeting", location: "", notes: "", allDay: false, start, end, ...fields };
}

function allDay(start: string, end: string, fields: Partial<EventContent> = {}): EventContent {
  return { calendarId: work, title: "Holiday", location: "", notes: "", allDay: true, start, end, ...fields };
}

function range(fromIso: string, toIso: string): EventRange {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return { from, to, dates: allDayRange(from, to, ZONE) };
}

const searchText = (id: number) =>
  db.prepare<[number], { search_text: string }>("SELECT search_text FROM events WHERE id = ?").get(id)?.search_text;

describe("create and get", () => {
  it("stores a timed event in UTC ms and gives it back as …Z", () => {
    const event = store.create(ana, { ...timed("2026-10-16T07:00:00Z", "2026-10-16T08:00:00Z"), tzid: ZONE });
    expect(event).toEqual({
      id: 1,
      calendarId: work,
      title: "Meeting",
      location: "",
      notes: "",
      allDay: false,
      start: "2026-10-16T07:00:00Z",
      end: "2026-10-16T08:00:00Z",
      tzid: ZONE,
      rrule: null,
      exdates: [],
      seriesId: null,
      originalStart: null,
      createdAt: "2026-10-16T09:00:00.000Z",
      updatedAt: "2026-10-16T09:00:00.000Z",
    });
    const row = db.prepare("SELECT start_at, end_at, start_date, end_date FROM events WHERE id = 1").get();
    expect(row).toEqual({ start_at: Date.parse("2026-10-16T07:00:00Z"), end_at: Date.parse("2026-10-16T08:00:00Z"), start_date: null, end_date: null });
    expect(store.get(ana, event.id)).toEqual(event);
  });

  it("stores an all-day event as dates", () => {
    const event = store.create(ana, { ...allDay("2026-10-16", "2026-10-18"), tzid: ZONE });
    expect(event).toMatchObject({ allDay: true, start: "2026-10-16", end: "2026-10-18" });
    const row = db.prepare("SELECT start_at, start_date, end_date FROM events WHERE id = ?").get(event.id);
    expect(row).toEqual({ start_at: null, start_date: "2026-10-16", end_date: "2026-10-18" });
  });

  it("stores a series' rrule", () => {
    const series = store.create(ana, {
      ...timed("2026-10-19T07:00:00Z", "2026-10-19T08:00:00Z"),
      tzid: ZONE,
      rrule: "FREQ=WEEKLY;BYDAY=MO",
    });
    expect(series.rrule).toBe("FREQ=WEEKLY;BYDAY=MO");
  });

  it("refuses a calendar that is not the user's with not_found", () => {
    const attempt = () => store.create(ana, { ...timed("2026-10-16T07:00:00Z", "2026-10-16T08:00:00Z", { calendarId: theirs }), tzid: ZONE });
    expect(attempt).toThrow(ApiError);
    expect(attempt).toThrow("There is no such calendar.");
  });

  it("keeps rows apart by user", () => {
    const event = store.create(ana, { ...allDay("2026-10-16", "2026-10-17"), tzid: ZONE });
    expect(store.get(ion, event.id)).toBeUndefined();
    expect(store.update(ion, event.id, { title: "Mine" })).toBeUndefined();
    expect(store.remove(ion, event.id)).toBe(false);
    expect(store.get(ana, event.id)).toEqual(event);
  });

  it("has the schema refuse an end before the start, a missing pair and a mixed pair", () => {
    const insert = (sql: string) => () =>
      db
        .prepare(
          `INSERT INTO events (user_id, calendar_id, title, all_day, start_at, end_at, start_date, end_date, tzid, search_text, created_at, updated_at)
           VALUES ('id-ana', ${work}, 'x', ${sql}, 'UTC', 'x', '', '')`,
        )
        .run();
    expect(insert("0, 2000, 1000, NULL, NULL")).toThrow(/CHECK/);
    expect(insert("0, NULL, NULL, NULL, NULL")).toThrow(/CHECK/);
    expect(insert("1, 1000, 2000, '2026-10-16', '2026-10-17'")).toThrow(/CHECK/);
    expect(insert("1, NULL, NULL, '2026-10-16', '2026-10-16'")).toThrow(/CHECK/);
    expect(insert("1, NULL, NULL, '2026-10-16', '2026-10-17'")).not.toThrow();
  });
});

describe("update", () => {
  it("changes what is given, keeps the rest and moves updatedAt", () => {
    const event = store.create(ana, { ...timed("2026-10-16T07:00:00Z", "2026-10-16T08:00:00Z"), tzid: ZONE });
    const moved = store.update(ana, event.id, { title: "Retro", end: "2026-10-16T09:00:00Z" });
    expect(moved).toEqual({ ...event, title: "Retro", end: "2026-10-16T09:00:00Z", updatedAt: "2026-10-16T09:00:01.000Z" });
  });

  it("turns a timed event all-day, clearing the other pair", () => {
    const event = store.create(ana, { ...timed("2026-10-16T07:00:00Z", "2026-10-16T08:00:00Z"), tzid: ZONE });
    const changed = store.update(ana, event.id, { allDay: true, start: "2026-10-16", end: "2026-10-17" });
    expect(changed).toMatchObject({ allDay: true, start: "2026-10-16", end: "2026-10-17" });
    const row = db.prepare("SELECT start_at, end_at FROM events WHERE id = ?").get(event.id);
    expect(row).toEqual({ start_at: null, end_at: null });
  });

  it("leaves the row alone when nothing changes", () => {
    const event = store.create(ana, { ...allDay("2026-10-16", "2026-10-17"), tzid: ZONE });
    expect(store.update(ana, event.id, { title: "Holiday" })).toEqual(event);
  });

  it("refuses moving it to another user's calendar", () => {
    const event = store.create(ana, { ...allDay("2026-10-16", "2026-10-17"), tzid: ZONE });
    expect(() => store.update(ana, event.id, { calendarId: theirs })).toThrow("There is no such calendar.");
    expect(store.get(ana, event.id)?.calendarId).toBe(work);
  });
});

describe("search text", () => {
  it("is set on create and every update, folded", () => {
    const event = store.create(ana, {
      ...timed("2026-10-16T07:00:00Z", "2026-10-16T08:00:00Z", { title: "Ședință", location: "Sala Mare", notes: "Agenda" }),
      tzid: ZONE,
    });
    expect(searchText(event.id)).toBe("sedinta\nsala mare\nagenda");
    store.update(ana, event.id, { location: "Cluj-Napoca" });
    expect(searchText(event.id)).toBe("sedinta\ncluj-napoca\nagenda");
  });

  it("finds the user's events by any field, ignoring case and diacritics", () => {
    const meeting = store.create(ana, { ...timed("2026-10-16T07:00:00Z", "2026-10-16T08:00:00Z", { title: "Ședință de grup" }), tzid: ZONE });
    const trip = store.create(ana, { ...allDay("2026-10-20", "2026-10-22", { notes: "după ȘEDINȚĂ" }), tzid: ZONE });
    store.create(ana, { ...allDay("2026-10-23", "2026-10-24", { title: "Something else" }), tzid: ZONE });
    store.create(ion, { ...allDay("2026-10-16", "2026-10-17", { calendarId: theirs, title: "Ședință" }), tzid: ZONE });
    expect(store.search(ana, "sedinta").map((event) => event.id)).toEqual([meeting.id, trip.id]);
    expect(store.search(ana, "ȘEDINȚĂ DE").map((event) => event.id)).toEqual([meeting.id]);
    expect(store.search(ana, "nothing")).toEqual([]);
    expect(store.search(ana, "́")).toEqual([]);
  });
});

describe("listInRange", () => {
  it("answers timed events that overlap the range, the ends exclusive", () => {
    const before = store.create(ana, { ...timed("2026-10-15T20:00:00Z", "2026-10-15T21:00:00Z"), tzid: ZONE });
    const across = store.create(ana, { ...timed("2026-10-15T20:00:00Z", "2026-10-15T22:00:00Z"), tzid: ZONE });
    const inside = store.create(ana, { ...timed("2026-10-16T07:00:00Z", "2026-10-16T08:00:00Z"), tzid: ZONE });
    const atEnd = store.create(ana, { ...timed("2026-10-16T21:00:00Z", "2026-10-16T22:00:00Z"), tzid: ZONE });
    // 16 October in Bucharest: 2026-10-15T21:00Z to 2026-10-16T21:00Z.
    const found = store.listInRange(ana, range("2026-10-15T21:00:00Z", "2026-10-16T21:00:00Z"));
    expect(found.map((event) => event.id)).toEqual([across.id, inside.id]);
    expect([before.id, atEnd.id].some((id) => found.some((event) => event.id === id))).toBe(false);
  });

  it("answers all-day events on the dates the range covers in the zone", () => {
    const fifteenth = store.create(ana, { ...allDay("2026-10-15", "2026-10-16"), tzid: ZONE });
    const sixteenth = store.create(ana, { ...allDay("2026-10-16", "2026-10-17"), tzid: ZONE });
    const spanning = store.create(ana, { ...allDay("2026-10-14", "2026-10-20"), tzid: ZONE });
    const seventeenth = store.create(ana, { ...allDay("2026-10-17", "2026-10-18"), tzid: ZONE });
    const found = store.listInRange(ana, range("2026-10-15T21:00:00Z", "2026-10-16T21:00:00Z"));
    expect(found.map((event) => event.id)).toEqual([sixteenth.id, spanning.id]);
    expect(found.some((event) => event.id === fifteenth.id || event.id === seventeenth.id)).toBe(false);
  });

  it("leaves out series rows and other users' events, and includes exceptions", () => {
    const series = store.create(ana, { ...timed("2026-10-12T07:00:00Z", "2026-10-12T08:00:00Z"), tzid: ZONE, rrule: "FREQ=DAILY" });
    const exception = store.insertException(ana, series.id, "2026-10-16T07:00:00Z", timed("2026-10-16T09:00:00Z", "2026-10-16T10:00:00Z"));
    store.create(ion, { ...timed("2026-10-16T07:00:00Z", "2026-10-16T08:00:00Z", { calendarId: theirs }), tzid: ZONE });
    const found = store.listInRange(ana, range("2026-10-15T21:00:00Z", "2026-10-16T21:00:00Z"));
    expect(found).toEqual([exception]);
  });
});

describe("the writes brief 04 builds on", () => {
  function weekly() {
    return store.create(ana, { ...timed("2026-10-19T07:00:00Z", "2026-10-19T08:00:00Z"), tzid: ZONE, rrule: "FREQ=WEEKLY" });
  }

  it("lists series that start before the range ends, timed and all-day", () => {
    const timedSeries = weekly();
    const allDaySeries = store.create(ana, { ...allDay("2026-10-01", "2026-10-02"), tzid: ZONE, rrule: "FREQ=YEARLY" });
    store.create(ana, { ...timed("2026-12-01T07:00:00Z", "2026-12-01T08:00:00Z"), tzid: ZONE, rrule: "FREQ=DAILY" });
    store.create(ana, { ...allDay("2026-10-16", "2026-10-17"), tzid: ZONE });
    const found = store.listSeries(ana, range("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"));
    expect(found.map((event) => event.id)).toEqual([timedSeries.id, allDaySeries.id]);
    expect(store.listSeries(ion, range("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"))).toEqual([]);
  });

  it("sets exdates de-duplicated and sorted, and the rrule", () => {
    const series = weekly();
    const keys = ["2026-11-02T08:00:00Z", "2026-10-26T08:00:00Z", "2026-11-02T08:00:00Z"];
    expect(store.setExdates(ana, series.id, keys)?.exdates).toEqual(["2026-10-26T08:00:00Z", "2026-11-02T08:00:00Z"]);
    expect(store.setRrule(ana, series.id, "FREQ=WEEKLY;COUNT=3")).toMatchObject({ rrule: "FREQ=WEEKLY;COUNT=3", exdates: keys.slice(1).sort() });
    expect(store.setExdates(ion, series.id, [])).toBeUndefined();
    expect(store.setRrule(ion, series.id, null)).toBeUndefined();
  });

  it("inserts an exception in the series' zone, at most one per occurrence", () => {
    const series = store.create(ana, { ...timed("2026-10-19T07:00:00Z", "2026-10-19T08:00:00Z"), tzid: "America/New_York", rrule: "FREQ=WEEKLY" });
    const exception = store.insertException(ana, series.id, "2026-10-26T07:00:00Z", timed("2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z", { title: "Moved" }));
    expect(exception).toMatchObject({ seriesId: series.id, originalStart: "2026-10-26T07:00:00Z", tzid: "America/New_York", rrule: null, title: "Moved" });
    expect(store.listExceptions(ana, series.id)).toEqual([exception]);
    expect(() => store.insertException(ana, series.id, "2026-10-26T07:00:00Z", timed("2026-10-26T11:00:00Z", "2026-10-26T12:00:00Z"))).toThrow(/UNIQUE/);
    // The schema keeps an rrule off an exception.
    expect(() => store.setRrule(ana, exception?.id ?? 0, "FREQ=DAILY")).toThrow(/CHECK/);
  });

  it("refuses an exception of a one-off event or another user's series", () => {
    const oneOff = store.create(ana, { ...allDay("2026-10-16", "2026-10-17"), tzid: ZONE });
    expect(store.insertException(ana, oneOff.id, "2026-10-16", allDay("2026-10-17", "2026-10-18"))).toBeUndefined();
    const series = weekly();
    expect(store.insertException(ion, series.id, "2026-10-26T07:00:00Z", timed("2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z", { calendarId: theirs }))).toBeUndefined();
  });

  it("deletes a series with its exceptions", () => {
    const series = weekly();
    const exception = store.insertException(ana, series.id, "2026-10-26T07:00:00Z", timed("2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z"));
    expect(store.remove(ana, series.id)).toBe(true);
    expect(store.get(ana, exception?.id ?? 0)).toBeUndefined();
  });
});
