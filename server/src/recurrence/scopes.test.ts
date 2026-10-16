import { calendarListSchema, occurrenceListSchema, occurrenceSchema, type Occurrence } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databasePath, openDb } from "../db/open.js";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";

/**
 * The edit scopes through the API, as the web app uses them: each test makes
 * a series with `POST /api/events`, edits or deletes one of its occurrences
 * by the `eventId` and `originalStart` the views show, and checks both what
 * the views show next and the rows left in the database.
 */

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
  expect(res.statusCode, res.body).toBe(status);
  const body = res.json() as { error: { code: string; message: string } };
  expect(body.error.code).toBe(code);
  return body.error.message;
}

const never = { type: "never" } as const;

/** Weekly on Monday, 10:00-11:00 in Bucharest, from 5 October 2026. Summer time ends on 25 October. */
const MONDAYS = {
  title: "Standup",
  allDay: false,
  start: "2026-10-05T10:00:00+03:00",
  end: "2026-10-05T11:00:00+03:00",
  repeat: { freq: "weekly", end: never },
};

/** The Mondays at 10:00 local, as keys: 07:00Z in summer time, 08:00Z after. */
const OCT = { 5: "2026-10-05T07:00:00Z", 12: "2026-10-12T07:00:00Z", 19: "2026-10-19T07:00:00Z", 26: "2026-10-26T08:00:00Z" };
const NOV = { 2: "2026-11-02T08:00:00Z", 9: "2026-11-09T08:00:00Z", 16: "2026-11-16T08:00:00Z" };

async function create(payload: object): Promise<Occurrence> {
  const res = await t.inject({ method: "POST", url: "/api/events", payload: { calendarId, ...payload } });
  expect(res.statusCode, res.body).toBe(201);
  return occurrenceSchema.parse(res.json());
}

async function patch(id: number, body: object, inject = t.inject): Promise<Response> {
  return inject({ method: "PATCH", url: `/api/events/${id}`, payload: body });
}

async function edit(id: number, body: object): Promise<Occurrence> {
  const res = await patch(id, body);
  expect(res.statusCode, res.body).toBe(200);
  return occurrenceSchema.parse(res.json());
}

async function remove(id: number, query: Record<string, string>, inject = t.inject): Promise<Response> {
  return inject({ method: "DELETE", url: `/api/events/${id}?${new URLSearchParams(query).toString()}` });
}

/** The occurrences from 1 October to 1 December 2026, Bucharest time. */
async function autumn(): Promise<Occurrence[]> {
  const from = encodeURIComponent("2026-10-01T00:00:00+03:00");
  const to = encodeURIComponent("2026-12-01T00:00:00+02:00");
  const res = await t.inject({ method: "GET", url: `/api/occurrences?from=${from}&to=${to}` });
  expect(res.statusCode).toBe(200);
  return occurrenceListSchema.parse(res.json()).occurrences;
}

/** `start title` for each occurrence, in order: what a list of them reads as. */
const shown = (list: Occurrence[]) => list.map((o) => `${o.start} ${o.title}`);

interface Row {
  id: number;
  title: string;
  rrule: string | null;
  exdates: string;
  series_id: number | null;
  original_start: string | null;
  start_at: number | null;
}

/** Every events row, by id, read on a second connection. */
function rows(): (Omit<Row, "exdates" | "start_at"> & { exdates: string[]; start: string | null })[] {
  const db = openDb(databasePath(t.dataDir));
  try {
    return db
      .prepare<[], Row>("SELECT id, title, rrule, exdates, series_id, original_start, start_at FROM events ORDER BY id")
      .all()
      .map(({ exdates, start_at, ...row }) => ({
        ...row,
        exdates: JSON.parse(exdates) as string[],
        start: start_at === null ? null : new Date(start_at).toISOString().replace(".000Z", "Z"),
      }));
  } finally {
    db.close();
  }
}

/** The occurrence with this start, as the views list it. */
async function at(start: string): Promise<Occurrence> {
  const found = (await autumn()).find((o) => o.start === start);
  if (!found) throw new Error(`No occurrence starts at ${start}`);
  return found;
}

describe("this event", () => {
  it("writes an exception for a generated occurrence and leaves the rest", async () => {
    const series = await create(MONDAYS);
    const moved = await edit(series.eventId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { title: "Planning", start: "2026-10-20T14:00:00+03:00", end: "2026-10-20T15:00:00+03:00" },
    });
    expect(moved).toMatchObject({
      id: `e${moved.eventId}`,
      seriesId: series.eventId,
      originalStart: OCT[19],
      title: "Planning",
      start: "2026-10-20T11:00:00Z",
      end: "2026-10-20T12:00:00Z",
      repeat: { freq: "weekly", byDay: ["MO"], end: never },
    });
    expect(moved.eventId).not.toBe(series.eventId);
    expect(shown(await autumn()).slice(0, 5)).toEqual([
      `${OCT[5]} Standup`,
      `${OCT[12]} Standup`,
      "2026-10-20T11:00:00Z Planning",
      `${OCT[26]} Standup`,
      `${NOV[2]} Standup`,
    ]);
  });

  it("updates an exception in place, by its own id or the series' and its key", async () => {
    const series = await create(MONDAYS);
    const first = await edit(series.eventId, { scope: "this", occurrence: OCT[19], changes: { title: "Planning" } });
    const again = await edit(first.eventId, { scope: "this", occurrence: OCT[19], changes: { location: "Room 2" } });
    expect(again).toMatchObject({ id: first.id, title: "Planning", location: "Room 2", start: OCT[19] });
    const viaSeries = await edit(series.eventId, { scope: "this", occurrence: OCT[19], changes: { notes: "Agenda" } });
    expect(viaSeries).toMatchObject({ id: first.id, title: "Planning", location: "Room 2", notes: "Agenda" });
    expect(rows().filter((row) => row.series_id !== null)).toHaveLength(1);
  });

  it("writes nothing for an edit that changes nothing", async () => {
    const series = await create(MONDAYS);
    const same = await edit(series.eventId, { scope: "this", occurrence: OCT[19], changes: { title: "Standup" } });
    expect(same.id).toBe(`s${series.eventId}:${OCT[19]}`);
    expect(rows()).toHaveLength(1);
  });

  it("refuses a change to the repeat", async () => {
    const series = await create(MONDAYS);
    const res = await patch(series.eventId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { repeat: { freq: "daily", end: never } },
    });
    expect(expectError(res, 400, "validation")).toMatch(/^repeat:/);
    // The same repeat again is no change.
    const same = await patch(series.eventId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { title: "Planning", repeat: { freq: "weekly", end: never } },
    });
    expect(same.statusCode).toBe(200);
  });

  it("deletes a generated occurrence as an excluded date", async () => {
    const series = await create(MONDAYS);
    expect((await remove(series.eventId, { scope: "this", occurrence: OCT[19] })).statusCode).toBe(204);
    expect(shown(await autumn()).slice(0, 3)).toEqual([`${OCT[5]} Standup`, `${OCT[12]} Standup`, `${OCT[26]} Standup`]);
    expect(rows()).toMatchObject([{ id: series.eventId, exdates: [OCT[19]] }]);
    // A deleted occurrence is no longer one to edit.
    expectError(await patch(series.eventId, { scope: "this", occurrence: OCT[19], changes: { title: "X" } }), 404, "not_found");
  });

  it("deletes an exception, and its slot stays empty", async () => {
    const series = await create(MONDAYS);
    const moved = await edit(series.eventId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { start: "2026-10-21T10:00:00+03:00", end: "2026-10-21T11:00:00+03:00" },
    });
    expect((await remove(moved.eventId, { scope: "this", occurrence: OCT[19] })).statusCode).toBe(204);
    const list = await autumn();
    expect(list.map((o) => o.start)).not.toContain(OCT[19]);
    expect(list.map((o) => o.start)).not.toContain("2026-10-21T07:00:00Z");
    expect(rows()).toMatchObject([{ id: series.eventId, exdates: [OCT[19]] }]);
  });

  it("removes the series when its last occurrence goes", async () => {
    const twice = await create({ ...MONDAYS, repeat: { freq: "weekly", end: { type: "count", count: 2 } } });
    await remove(twice.eventId, { scope: "this", occurrence: OCT[12] });
    expect(rows()).toHaveLength(1);
    await remove(twice.eventId, { scope: "this", occurrence: OCT[5] });
    expect(rows()).toEqual([]);
  });
});

describe("this and following events", () => {
  it("ends the old series the day before and starts a new one with the changes", async () => {
    const series = await create(MONDAYS);
    const next = await edit(series.eventId, { scope: "following", occurrence: OCT[19], changes: { title: "Sync" } });
    const [old, created] = rows();
    expect(old).toMatchObject({ id: series.eventId, title: "Standup", rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261018T205959Z" });
    expect(created).toMatchObject({ title: "Sync", rrule: "FREQ=WEEKLY;BYDAY=MO", start: OCT[19], series_id: null });
    expect(next).toMatchObject({
      id: `s${created?.id}:${OCT[19]}`,
      eventId: created?.id,
      seriesId: created?.id,
      originalStart: OCT[19],
      title: "Sync",
      repeat: { freq: "weekly", byDay: ["MO"], end: never },
    });
    expect(shown(await autumn()).slice(0, 5)).toEqual([
      `${OCT[5]} Standup`,
      `${OCT[12]} Standup`,
      `${OCT[19]} Sync`,
      `${OCT[26]} Sync`,
      `${NOV[2]} Sync`,
    ]);
    const before = await at(OCT[12]);
    expect(before.repeat).toEqual({ freq: "weekly", byDay: ["MO"], end: { type: "until", date: "2026-10-18" } });
  });

  it("moves the exceptions and deleted dates after the split, re-keyed when the time moves", async () => {
    const series = await create(MONDAYS);
    // Before the split: 12 Oct deleted. After: 26 Oct moved to Tuesday, 9 Nov renamed, 2 Nov deleted.
    await remove(series.eventId, { scope: "this", occurrence: OCT[12] });
    const tuesday = await edit(series.eventId, {
      scope: "this",
      occurrence: OCT[26],
      changes: { start: "2026-10-27T10:00:00+02:00", end: "2026-10-27T11:00:00+02:00" },
    });
    const renamed = await edit(series.eventId, { scope: "this", occurrence: NOV[9], changes: { title: "Retro" } });
    await remove(series.eventId, { scope: "this", occurrence: NOV[2] });

    // 19 Oct dragged from 10:00 to 11:30, "this and following".
    const next = await edit(series.eventId, {
      scope: "following",
      occurrence: OCT[19],
      changes: { start: "2026-10-19T11:30:00+03:00", end: "2026-10-19T12:30:00+03:00" },
    });
    expect(next.start).toBe("2026-10-19T08:30:00Z");
    const all = rows();
    const created = all.find((row) => row.rrule === "FREQ=WEEKLY;BYDAY=MO" && row.id !== series.eventId);
    expect(all.find((row) => row.id === series.eventId)).toMatchObject({ exdates: [OCT[12]] });
    expect(created).toMatchObject({ start: "2026-10-19T08:30:00Z", exdates: ["2026-11-02T09:30:00Z"] });
    expect(all.find((row) => row.id === tuesday.eventId)).toMatchObject({ series_id: created?.id, original_start: "2026-10-26T09:30:00Z" });
    expect(all.find((row) => row.id === renamed.eventId)).toMatchObject({ series_id: created?.id, original_start: "2026-11-09T09:30:00Z" });

    expect(shown(await autumn()).slice(0, 6)).toEqual([
      `${OCT[5]} Standup`,
      "2026-10-19T08:30:00Z Standup",
      "2026-10-27T08:00:00Z Standup",
      "2026-11-09T09:30:00Z Retro",
      "2026-11-16T09:30:00Z Standup",
      "2026-11-23T09:30:00Z Standup",
    ]);
  });

  it("drops the exceptions that no longer fall on the new repeat", async () => {
    const series = await create(MONDAYS);
    await edit(series.eventId, { scope: "this", occurrence: NOV[2], changes: { title: "Retro" } });
    // From 19 Oct on, Tuesdays instead: the new series starts on Tuesday the 20th.
    const next = await edit(series.eventId, {
      scope: "following",
      occurrence: OCT[19],
      changes: { repeat: { freq: "weekly", byDay: ["TU"], end: never } },
    });
    expect(next).toMatchObject({ start: "2026-10-20T07:00:00Z", repeat: { freq: "weekly", byDay: ["TU"], end: never } });
    expect(rows().filter((row) => row.title === "Retro")).toEqual([]);
    expect(shown(await autumn()).slice(0, 4)).toEqual([
      `${OCT[5]} Standup`,
      `${OCT[12]} Standup`,
      "2026-10-20T07:00:00Z Standup",
      "2026-10-27T08:00:00Z Standup",
    ]);
  });

  it("carries a change of title to the moved exceptions that had the old one", async () => {
    const series = await create(MONDAYS);
    const moved = await edit(series.eventId, {
      scope: "this",
      occurrence: OCT[26],
      changes: { start: "2026-10-27T10:00:00+02:00", end: "2026-10-27T11:00:00+02:00" },
    });
    const renamed = await edit(series.eventId, { scope: "this", occurrence: NOV[2], changes: { title: "Retro" } });
    await edit(series.eventId, { scope: "following", occurrence: OCT[19], changes: { title: "Sync" } });
    const all = rows();
    expect(all.find((row) => row.id === moved.eventId)).toMatchObject({ title: "Sync", original_start: OCT[26] });
    expect(all.find((row) => row.id === renamed.eventId)).toMatchObject({ title: "Retro", original_start: NOV[2] });
  });

  it("edits an exception and the ones after it from the exception's own id", async () => {
    const series = await create(MONDAYS);
    const moved = await edit(series.eventId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { start: "2026-10-20T10:00:00+03:00", end: "2026-10-20T11:00:00+03:00" },
    });
    await edit(moved.eventId, { scope: "following", changes: { title: "Sync" } });
    expect(shown(await autumn()).slice(0, 4)).toEqual([
      `${OCT[5]} Standup`,
      `${OCT[12]} Standup`,
      "2026-10-20T07:00:00Z Sync",
      `${OCT[26]} Sync`,
    ]);
  });

  /** 19 October moved to Tuesday the 20th, same time: an exception away from its slot. */
  async function tuesdayException(seriesId: number): Promise<Occurrence> {
    return edit(seriesId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { start: "2026-10-20T10:00:00+03:00", end: "2026-10-20T11:00:00+03:00" },
    });
  }

  /** The series "following" made: the row with a rule that isn't the old series. */
  const createdSeries = (oldId: number) => rows().find((row) => row.rrule !== null && row.id !== oldId);

  it("keeps the new series on the slot when only the end of a moved exception changes", async () => {
    const series = await create(MONDAYS);
    const tuesday = await tuesdayException(series.eventId);
    await edit(tuesday.eventId, { scope: "following", changes: { end: "2026-10-20T11:30:00+03:00" } });
    const created = createdSeries(series.eventId);
    expect(created).toMatchObject({ rrule: "FREQ=WEEKLY;BYDAY=MO", start: OCT[19] });
    expect(rows().find((row) => row.id === tuesday.eventId)).toMatchObject({ series_id: created?.id, original_start: OCT[19] });
    expect((await autumn()).slice(0, 4).map((o) => [o.start, o.end])).toEqual([
      [OCT[5], "2026-10-05T08:00:00Z"],
      [OCT[12], "2026-10-12T08:00:00Z"],
      ["2026-10-20T07:00:00Z", "2026-10-20T08:30:00Z"],
      [OCT[26], "2026-10-26T09:30:00Z"],
    ]);
  });

  it("shifts the new series by as far as a moved exception is dragged", async () => {
    const series = await create(MONDAYS);
    const tuesday = await tuesdayException(series.eventId);
    // An hour later on its Tuesday: from the 19th on, Mondays an hour later.
    await edit(tuesday.eventId, {
      scope: "following",
      changes: { start: "2026-10-20T11:00:00+03:00", end: "2026-10-20T12:00:00+03:00" },
    });
    const created = createdSeries(series.eventId);
    expect(created).toMatchObject({ rrule: "FREQ=WEEKLY;BYDAY=MO", start: "2026-10-19T08:00:00Z" });
    expect(rows().find((row) => row.id === tuesday.eventId)).toMatchObject({
      series_id: created?.id,
      original_start: "2026-10-19T08:00:00Z",
    });
    expect((await autumn()).slice(2, 4).map((o) => o.start)).toEqual(["2026-10-20T08:00:00Z", "2026-10-26T09:00:00Z"]);
  });

  it("follows a moved exception's own date for a new repeat from there", async () => {
    const series = await create(MONDAYS);
    const tuesday = await tuesdayException(series.eventId);
    const first = await edit(tuesday.eventId, { scope: "following", changes: { repeat: { freq: "monthly", end: never } } });
    expect(first).toMatchObject({ start: "2026-10-20T07:00:00Z", repeat: { freq: "monthly", end: never } });
    expect(createdSeries(series.eventId)).toMatchObject({ rrule: "FREQ=MONTHLY;BYMONTHDAY=20" });
  });

  it("moves the chosen weekdays with a drag to another day", async () => {
    const series = await create({ ...MONDAYS, repeat: { freq: "weekly", byDay: ["MO", "WE"], end: never } });
    // Wednesday 14 October dragged to Thursday: from then on, Tuesdays and Thursdays.
    const next = await edit(series.eventId, {
      scope: "following",
      occurrence: "2026-10-14T07:00:00Z",
      changes: { start: "2026-10-15T10:00:00+03:00", end: "2026-10-15T11:00:00+03:00" },
    });
    expect(next).toMatchObject({ start: "2026-10-15T07:00:00Z", repeat: { freq: "weekly", byDay: ["TU", "TH"], end: never } });
    expect((await autumn()).slice(0, 6).map((o) => o.start.slice(0, 10))).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-12",
      "2026-10-15",
      "2026-10-20",
      "2026-10-22",
    ]);
  });

  it("splits a counted series so each part keeps its share of the count", async () => {
    // Six Mondays, 5 Oct to 9 Nov; 12 Oct deleted, which still counts.
    const six = await create({ ...MONDAYS, repeat: { freq: "weekly", end: { type: "count", count: 6 } } });
    await remove(six.eventId, { scope: "this", occurrence: OCT[12] });
    const next = await edit(six.eventId, { scope: "following", occurrence: OCT[26], changes: { title: "Sync" } });
    const [old, created] = rows();
    expect(old).toMatchObject({ rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=3", exdates: [OCT[12]] });
    expect(created).toMatchObject({ rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=3", start: OCT[26] });
    expect(next.repeat).toEqual({ freq: "weekly", byDay: ["MO"], end: { type: "count", count: 3 } });
    expect(shown(await autumn())).toEqual([
      `${OCT[5]} Standup`,
      `${OCT[19]} Standup`,
      `${OCT[26]} Sync`,
      `${NOV[2]} Sync`,
      `${NOV[9]} Sync`,
    ]);
  });

  it("is all events on the first occurrence", async () => {
    const series = await create(MONDAYS);
    const next = await edit(series.eventId, { scope: "following", occurrence: OCT[5], changes: { title: "Sync" } });
    expect(next.id).toBe(`s${series.eventId}:${OCT[5]}`);
    expect(rows()).toMatchObject([{ id: series.eventId, title: "Sync", rrule: "FREQ=WEEKLY;BYDAY=MO" }]);
    // Also when every occurrence before it is deleted.
    await remove(series.eventId, { scope: "this", occurrence: OCT[5] });
    await edit(series.eventId, { scope: "following", occurrence: OCT[12], changes: { title: "Daily" } });
    expect(rows()).toMatchObject([{ id: series.eventId, title: "Daily" }]);
  });

  it("leaves a one-off when the repeat is turned off from here", async () => {
    const series = await create(MONDAYS);
    const renamed = await edit(series.eventId, { scope: "this", occurrence: NOV[2], changes: { title: "Retro" } });
    const single = await edit(series.eventId, { scope: "following", occurrence: OCT[19], changes: { repeat: null } });
    expect(single).toMatchObject({ seriesId: null, originalStart: null, repeat: null, start: OCT[19] });
    expect(rows().filter((row) => row.title === renamed.title || row.series_id !== null)).toEqual([]);
    expect(shown(await autumn())).toEqual([`${OCT[5]} Standup`, `${OCT[12]} Standup`, `${OCT[19]} Standup`]);
  });

  it("deletes this occurrence and the ones after it", async () => {
    const series = await create(MONDAYS);
    await edit(series.eventId, { scope: "this", occurrence: NOV[2], changes: { title: "Retro" } });
    const early = await edit(series.eventId, { scope: "this", occurrence: OCT[5], changes: { title: "Kickoff" } });
    expect((await remove(series.eventId, { scope: "following", occurrence: OCT[19] })).statusCode).toBe(204);
    expect(shown(await autumn())).toEqual([`${OCT[5]} Kickoff`, `${OCT[12]} Standup`]);
    expect(rows().map((row) => row.id)).toEqual([series.eventId, early.eventId]);
    expect(rows().filter((row) => row.title === "Retro")).toEqual([]);
  });

  it("deletes the whole series from the first occurrence", async () => {
    const series = await create(MONDAYS);
    await edit(series.eventId, { scope: "this", occurrence: NOV[2], changes: { title: "Retro" } });
    expect((await remove(series.eventId, { scope: "following", occurrence: OCT[5] })).statusCode).toBe(204);
    expect(rows()).toEqual([]);
  });
});

describe("all events", () => {
  it("changes the title of the series and of the exceptions that kept it", async () => {
    const series = await create(MONDAYS);
    await remove(series.eventId, { scope: "this", occurrence: OCT[12] });
    const moved = await edit(series.eventId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { start: "2026-10-20T10:00:00+03:00", end: "2026-10-20T11:00:00+03:00" },
    });
    const renamed = await edit(series.eventId, { scope: "this", occurrence: OCT[26], changes: { title: "Retro" } });
    const first = await edit(series.eventId, { scope: "all", occurrence: NOV[2], changes: { title: "Sync" } });
    expect(first.id).toBe(`s${series.eventId}:${OCT[5]}`);
    expect(shown(await autumn()).slice(0, 4)).toEqual([
      `${OCT[5]} Sync`,
      "2026-10-20T07:00:00Z Sync",
      `${OCT[26]} Retro`,
      `${NOV[2]} Sync`,
    ]);
    expect(rows().find((row) => row.id === series.eventId)).toMatchObject({ exdates: [OCT[12]] });
    expect(rows().map((row) => row.id)).toEqual(expect.arrayContaining([moved.eventId, renamed.eventId]));
  });

  it("changing an exception's title for all events changes it too", async () => {
    const series = await create(MONDAYS);
    const renamed = await edit(series.eventId, { scope: "this", occurrence: OCT[26], changes: { title: "Retro" } });
    await edit(renamed.eventId, { scope: "all", changes: { title: "Sync" } });
    expect(new Set((await autumn()).map((o) => o.title))).toEqual(new Set(["Sync"]));
  });

  it("shifts the whole series by a drag, keeping local time across the change of time, and drops its exceptions", async () => {
    const series = await create(MONDAYS);
    await remove(series.eventId, { scope: "this", occurrence: OCT[12] });
    await edit(series.eventId, { scope: "this", occurrence: NOV[2], changes: { title: "Retro" } });
    // 26 Oct dragged from 10:00 to 11:30, the same length.
    const first = await edit(series.eventId, {
      scope: "all",
      occurrence: OCT[26],
      changes: { start: "2026-10-26T11:30:00+02:00", end: "2026-10-26T12:30:00+02:00" },
    });
    expect(first).toMatchObject({ start: "2026-10-05T08:30:00Z", end: "2026-10-05T09:30:00Z" });
    expect(shown(await autumn()).slice(0, 6)).toEqual([
      "2026-10-05T08:30:00Z Standup",
      "2026-10-12T08:30:00Z Standup",
      "2026-10-19T08:30:00Z Standup",
      "2026-10-26T09:30:00Z Standup",
      "2026-11-02T09:30:00Z Standup",
      "2026-11-09T09:30:00Z Standup",
    ]);
    expect(rows()).toMatchObject([{ id: series.eventId, exdates: [] }]);
    expect(rows().filter((row) => row.title === "Retro")).toEqual([]);
  });

  it("moves a weekly series' day with a drag to another day", async () => {
    const series = await create(MONDAYS);
    const first = await edit(series.eventId, {
      scope: "all",
      occurrence: OCT[19],
      changes: { start: "2026-10-20T10:00:00+03:00", end: "2026-10-20T11:00:00+03:00" },
    });
    expect(first).toMatchObject({ start: "2026-10-06T07:00:00Z", repeat: { freq: "weekly", byDay: ["TU"], end: never } });
    expect(rows()).toMatchObject([{ rrule: "FREQ=WEEKLY;BYDAY=TU" }]);
  });

  it("changes the length when only the end moves", async () => {
    const series = await create(MONDAYS);
    await edit(series.eventId, { scope: "all", occurrence: OCT[26], changes: { end: "2026-10-26T11:30:00+02:00" } });
    expect((await autumn()).slice(2, 4).map((o) => [o.start, o.end])).toEqual([
      [OCT[19], "2026-10-19T08:30:00Z"],
      [OCT[26], "2026-10-26T09:30:00Z"],
    ]);
  });

  it("moves the series only as far as a moved exception moves, not by where it was moved to", async () => {
    const series = await create(MONDAYS);
    const tuesday = await edit(series.eventId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { start: "2026-10-20T10:00:00+03:00", end: "2026-10-20T11:00:00+03:00" },
    });
    // Only the end changes: every occurrence gets longer, and stays on Monday at 10:00.
    const longer = await edit(tuesday.eventId, { scope: "all", changes: { end: "2026-10-20T11:30:00+03:00" } });
    expect(longer).toMatchObject({ start: OCT[5], end: "2026-10-05T08:30:00Z", repeat: { freq: "weekly", byDay: ["MO"] } });
    expect(rows()).toMatchObject([{ id: series.eventId, rrule: "FREQ=WEEKLY;BYDAY=MO" }]);
    expect((await autumn()).slice(2, 4).map((o) => [o.start, o.end])).toEqual([
      [OCT[19], "2026-10-19T08:30:00Z"],
      [OCT[26], "2026-10-26T09:30:00Z"],
    ]);
  });

  it("shifts the series by as far as a moved exception is dragged", async () => {
    const series = await create(MONDAYS);
    const tuesday = await edit(series.eventId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { start: "2026-10-20T10:00:00+03:00", end: "2026-10-20T11:00:00+03:00" },
    });
    // An hour later on its Tuesday: the Mondays move an hour later, and stay Mondays.
    const first = await edit(tuesday.eventId, {
      scope: "all",
      changes: { start: "2026-10-20T11:00:00+03:00", end: "2026-10-20T12:00:00+03:00" },
    });
    expect(first).toMatchObject({ start: "2026-10-05T08:00:00Z", end: "2026-10-05T09:00:00Z", repeat: { byDay: ["MO"] } });
    expect(rows()).toMatchObject([{ id: series.eventId, rrule: "FREQ=WEEKLY;BYDAY=MO" }]);
  });

  it("follows a moved exception's own date for a new repeat, as the form words it", async () => {
    const series = await create(MONDAYS);
    const tuesday = await edit(series.eventId, {
      scope: "this",
      occurrence: OCT[19],
      changes: { start: "2026-10-20T10:00:00+03:00", end: "2026-10-20T11:00:00+03:00" },
    });
    const first = await edit(tuesday.eventId, { scope: "all", changes: { repeat: { freq: "monthly", end: never } } });
    expect(first).toMatchObject({ start: "2026-10-20T07:00:00Z", repeat: { freq: "monthly", end: never } });
    expect(rows()).toMatchObject([{ id: series.eventId, rrule: "FREQ=MONTHLY;BYMONTHDAY=20" }]);
  });

  it("changes the repeat and drops the exceptions and deleted dates", async () => {
    const series = await create(MONDAYS);
    await remove(series.eventId, { scope: "this", occurrence: OCT[12] });
    await edit(series.eventId, { scope: "this", occurrence: OCT[19], changes: { title: "Retro" } });
    const first = await edit(series.eventId, {
      scope: "all",
      occurrence: OCT[19],
      changes: { repeat: { freq: "weekly", byDay: ["MO", "WE"], end: { type: "until", date: "2026-10-14" } } },
    });
    expect(first.repeat).toEqual({ freq: "weekly", byDay: ["MO", "WE"], end: { type: "until", date: "2026-10-14" } });
    expect(shown(await autumn())).toEqual([
      `${OCT[5]} Standup`,
      "2026-10-07T07:00:00Z Standup",
      `${OCT[12]} Standup`,
      "2026-10-14T07:00:00Z Standup",
    ]);
    expect(rows()).toMatchObject([{ id: series.eventId, rrule: "FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261014T205959Z", exdates: [] }]);
  });

  it("follows the edited occurrence for a new monthly repeat", async () => {
    const series = await create(MONDAYS);
    const first = await edit(series.eventId, {
      scope: "all",
      occurrence: OCT[19],
      changes: { repeat: { freq: "monthly", end: never } },
    });
    expect(first).toMatchObject({ start: OCT[19], repeat: { freq: "monthly", end: never } });
    expect(rows()).toMatchObject([{ rrule: "FREQ=MONTHLY;BYMONTHDAY=19", start: OCT[19] }]);
    expect(shown(await autumn())).toEqual([`${OCT[19]} Standup`, `${"2026-11-19T08:00:00Z"} Standup`]);
  });

  it("leaves the edited occurrence as a one-off when the repeat is turned off", async () => {
    const series = await create(MONDAYS);
    await edit(series.eventId, { scope: "this", occurrence: NOV[2], changes: { title: "Retro" } });
    const single = await edit(series.eventId, { scope: "all", occurrence: OCT[19], changes: { repeat: null } });
    expect(single).toMatchObject({ id: `e${series.eventId}`, seriesId: null, repeat: null, start: OCT[19] });
    expect(rows()).toMatchObject([{ id: series.eventId, rrule: null, exdates: [] }]);
    expect(shown(await autumn())).toEqual([`${OCT[19]} Standup`]);
  });

  it("deletes the series and its exceptions", async () => {
    const series = await create(MONDAYS);
    const renamed = await edit(series.eventId, { scope: "this", occurrence: NOV[2], changes: { title: "Retro" } });
    expect((await remove(renamed.eventId, { scope: "all" })).statusCode).toBe(204);
    expect(rows()).toEqual([]);
    expect(await autumn()).toEqual([]);
  });

  it("turns a timed series all-day, on the same days", async () => {
    const series = await create({ ...MONDAYS, repeat: { freq: "weekly", end: { type: "until", date: "2026-10-26" } } });
    const first = await edit(series.eventId, {
      scope: "all",
      occurrence: OCT[19],
      changes: { allDay: true, start: "2026-10-19", end: "2026-10-20" },
    });
    expect(first).toMatchObject({ id: `s${series.eventId}:2026-10-05`, allDay: true, start: "2026-10-05", end: "2026-10-06" });
    expect(rows()).toMatchObject([{ rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261026", start: null }]);
    expect((await autumn()).map((o) => o.start)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  });

  it("takes the series' own start when no occurrence is named", async () => {
    const series = await create(MONDAYS);
    const first = await edit(series.eventId, { scope: "all", changes: { title: "Sync" } });
    expect(first).toMatchObject({ start: OCT[5], title: "Sync" });
  });
});

describe("all-day series", () => {
  it("edits and deletes by date keys", async () => {
    const series = await create({ title: "Gym", allDay: true, start: "2026-10-05", end: "2026-10-06", repeat: { freq: "weekly", end: never } });
    const moved = await edit(series.eventId, {
      scope: "this",
      occurrence: "2026-10-12",
      changes: { start: "2026-10-13", end: "2026-10-14" },
    });
    expect(moved).toMatchObject({ originalStart: "2026-10-12", start: "2026-10-13", allDay: true });
    await remove(series.eventId, { scope: "this", occurrence: "2026-10-19" });
    await edit(series.eventId, { scope: "following", occurrence: "2026-11-02", changes: { title: "Swim" } });
    expect(rows()[0]).toMatchObject({ rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261101", exdates: ["2026-10-19"] });
    expect(shown(await autumn()).slice(0, 5)).toEqual([
      "2026-10-05 Gym",
      "2026-10-13 Gym",
      "2026-10-26 Gym",
      "2026-11-02 Swim",
      "2026-11-09 Swim",
    ]);
    // A timed key names no occurrence of an all-day series.
    expectError(await patch(series.eventId, { scope: "this", occurrence: "2026-10-05T00:00:00Z", changes: { title: "X" } }), 404, "not_found");
  });
});

describe("aiming at an occurrence", () => {
  it("needs a scope for a series or an exception", async () => {
    const series = await create(MONDAYS);
    expect(expectError(await patch(series.eventId, { occurrence: OCT[19], changes: { title: "X" } }), 400, "validation")).toMatch(
      /^scope:/,
    );
    expectError(await remove(series.eventId, {}), 400, "validation");
    const renamed = await edit(series.eventId, { scope: "this", occurrence: OCT[19], changes: { title: "Retro" } });
    expectError(await remove(renamed.eventId, {}), 400, "validation");
    expect(rows()).toHaveLength(2);
  });

  it("needs the occurrence for this and following, and one the series has", async () => {
    const series = await create(MONDAYS);
    expect(expectError(await patch(series.eventId, { scope: "this", changes: { title: "X" } }), 400, "validation")).toMatch(
      /^occurrence:/,
    );
    expectError(await remove(series.eventId, { scope: "following" }), 400, "validation");
    // A Tuesday, 11:00 on a Monday, and a Monday after... none of them is an occurrence.
    for (const occurrence of ["2026-10-20T07:00:00Z", "2026-10-19T08:00:00Z", "2026-10-19"]) {
      expectError(await patch(series.eventId, { scope: "this", occurrence, changes: { title: "X" } }), 404, "not_found");
    }
    expectError(await remove(series.eventId, { scope: "this", occurrence: "2026-09-28T07:00:00Z" }), 404, "not_found");
  });

  it("refuses an exception aimed at another occurrence than its own", async () => {
    const series = await create(MONDAYS);
    const renamed = await edit(series.eventId, { scope: "this", occurrence: OCT[19], changes: { title: "Retro" } });
    expectError(await patch(renamed.eventId, { scope: "this", occurrence: OCT[26], changes: { title: "X" } }), 400, "validation");
  });

  it("gives another user 404 for the series and its exceptions, and changes nothing", async () => {
    const series = await create(MONDAYS);
    const renamed = await edit(series.eventId, { scope: "this", occurrence: OCT[19], changes: { title: "Retro" } });
    const before = rows();
    const other = await t.signInAs("other");
    for (const scope of ["this", "following", "all"]) {
      for (const id of [series.eventId, renamed.eventId]) {
        expectError(await patch(id, { scope, occurrence: OCT[19], changes: { title: "Mine" } }, other.inject), 404, "not_found");
        expectError(await remove(id, { scope, occurrence: OCT[19] }, other.inject), 404, "not_found");
      }
    }
    expect(rows()).toEqual(before);
  });
});
