import { calendarListSchema, occurrenceSchema, type Occurrence, type PushPayload } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databasePath, openDb, type Db } from "../db/open.js";
import type { PushService } from "../push/push.js";
import { createEventStore } from "../store/events.js";
import { createPushSubscriptionStore } from "../store/push-subscriptions.js";
import { createSettingsStore } from "../store/settings.js";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";
import { dueAt } from "./due.js";
import { dayPath, reminderPayload } from "./message.js";
import { createSentLog } from "./sent-log.js";
import { SENT_KEEP_MS, createReminders, type Reminders } from "./timer.js";

/**
 * The reminders with a fake clock (brief 16). Events are made through the API,
 * as the event form makes them; the reminders run on a second connection to
 * the same database, with a stand-in push service that records what it was
 * asked to send. The app's own timer is off.
 */

let t: SignedInTestApp;
let db: Db;
let calendarId: number;
let clock: number;
let sent: { userId: string; payload: PushPayload }[];

const push: PushService = {
  publicKey: "not-a-key",
  sendToUser: async (userId, payload) => {
    sent.push({ userId, payload });
    return { sent: 1 };
  },
};

const MINUTE = 60_000;
const at = (iso: string) => Date.parse(iso);

function userId(username: string): string {
  return (db.prepare("SELECT id FROM auth_users WHERE username = ?").get(username) as { id: string }).id;
}

/** A browser subscribed for the user (made up, never sent to: the push service here is a stand-in). */
function subscribe(username: string): void {
  createPushSubscriptionStore(db).save(userId(username), {
    endpoint: `https://fcm.googleapis.com/fcm/send/${username}`,
    p256dh: "p",
    auth: "a",
  });
}

/** The reminders as a process started at the clock's time would run them. */
function start(): Reminders {
  return createReminders({
    events: createEventStore(db),
    settings: createSettingsStore(db),
    subscriptions: createPushSubscriptionStore(db),
    sentLog: createSentLog(db),
    push,
    webBase: "/almanac/",
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    now: () => clock,
  });
}

/** Ticks at each of `times` in turn. */
async function tickAt(reminders: Reminders, ...times: number[]): Promise<void> {
  for (const time of times) {
    clock = time;
    await reminders.tick();
  }
}

/** Creates the event through the API, on the owner's calendar, or with `inject` on that user's first one. */
async function create(payload: object, inject?: SignedInTestApp["inject"]): Promise<Occurrence> {
  let calendar = calendarId;
  if (inject !== undefined) {
    const list = await inject({ method: "GET", url: "/api/calendars" });
    calendar = calendarListSchema.parse(list.json()).calendars[0]?.id ?? 0;
  }
  const res = await (inject ?? t.inject)({ method: "POST", url: "/api/events", payload: { calendarId: calendar, ...payload } });
  expect(res.statusCode, res.body).toBe(201);
  return occurrenceSchema.parse(res.json());
}

async function patch(id: number, payload: object): Promise<void> {
  const res = await t.inject({ method: "PATCH", url: `/api/events/${id}`, payload });
  expect(res.statusCode, res.body).toBe(200);
}

const titles = () => sent.map((each) => each.payload.title);

beforeEach(async () => {
  t = await startSignedInApp({ REMINDER_TIMER: "off" });
  const res = await t.inject({ method: "GET", url: "/api/calendars" });
  calendarId = calendarListSchema.parse(res.json()).calendars[0]?.id ?? 0;
  db = openDb(databasePath(t.dataDir));
  subscribe("owner");
  sent = [];
});

afterEach(async () => {
  db.close();
  await t.close();
});

const dentist = { title: "Dentist", allDay: false, start: "2026-10-27T14:30:00+02:00", end: "2026-10-27T15:30:00+02:00" };
const DENTIST_DUE = at("2026-10-27T12:20:00Z");

describe("a timed event", () => {
  it("with a 10-minute reminder sends once, at the start less 10 minutes", async () => {
    await create({ ...dentist, location: "Str. Mare 4", reminderMinutes: 10 });
    clock = DENTIST_DUE - 2 * MINUTE;
    const reminders = start();
    await tickAt(reminders, DENTIST_DUE - MINUTE, DENTIST_DUE - 1);
    expect(sent).toEqual([]);
    await tickAt(reminders, DENTIST_DUE, DENTIST_DUE + MINUTE, DENTIST_DUE + 2 * MINUTE);
    expect(sent).toEqual([
      {
        userId: userId("owner"),
        payload: {
          title: "Dentist, 14:30",
          body: "Str. Mare 4",
          url: "/almanac/day/2026/10/27",
          tag: expect.stringMatching(/^reminder:\d+:2026-10-27T12:30:00Z$/),
        },
      },
    ]);
  });

  it("at the start sends at the start", async () => {
    await create({ ...dentist, reminderMinutes: 0 });
    clock = at("2026-10-27T12:00:00Z");
    const reminders = start();
    await tickAt(reminders, at("2026-10-27T12:29:00Z"));
    expect(sent).toEqual([]);
    await tickAt(reminders, at("2026-10-27T12:30:00Z"));
    expect(titles()).toEqual(["Dentist, 14:30"]);
  });

  it("a day before says tomorrow", async () => {
    await create({ ...dentist, reminderMinutes: 1440 });
    clock = at("2026-10-26T12:25:00Z");
    await tickAt(start(), at("2026-10-26T12:30:00Z"));
    expect(titles()).toEqual(["Dentist, tomorrow at 14:30"]);
  });

  it("without a reminder sends nothing", async () => {
    await create(dentist);
    clock = DENTIST_DUE - MINUTE;
    await tickAt(start(), DENTIST_DUE, at("2026-10-27T12:30:00Z"));
    expect(sent).toEqual([]);
  });
});

describe("a weekly series", () => {
  // Mondays 10:00 in Bucharest, across the end of summer time on 25 October.
  const standup = {
    title: "Standup",
    allDay: false,
    start: "2026-10-19T10:00:00+03:00",
    end: "2026-10-19T10:30:00+03:00",
    repeat: { freq: "weekly", end: { type: "never" } },
    reminderMinutes: 15,
  };
  const dues = [at("2026-10-19T06:45:00Z"), at("2026-10-26T07:45:00Z"), at("2026-11-02T07:45:00Z")];

  it("sends once per occurrence, at the same wall-clock time either side of the clock change", async () => {
    await create(standup);
    clock = dues[0]! - 20 * MINUTE;
    const reminders = start();
    for (const due of dues) await tickAt(reminders, due - 5 * MINUTE, due, due + MINUTE, due + 5 * MINUTE);
    expect(titles()).toEqual(["Standup, 10:00", "Standup, 10:00", "Standup, 10:00"]);
    expect(sent.map((each) => each.payload.url)).toEqual(["/almanac/day/2026/10/19", "/almanac/day/2026/10/26", "/almanac/day/2026/11/2"]);
  });

  it("follows an occurrence's own reminder, and none for one set to none", async () => {
    const series = await create(standup);
    await patch(series.eventId, { scope: "this", occurrence: "2026-10-26T08:00:00Z", changes: { reminderMinutes: 60 } });
    await patch(series.eventId, { scope: "this", occurrence: "2026-11-02T08:00:00Z", changes: { reminderMinutes: null } });
    clock = dues[0]! - 20 * MINUTE;
    const reminders = start();
    const ownDue = at("2026-10-26T07:00:00Z");
    for (const due of [dues[0]!, ownDue, dues[1]!, dues[2]!]) await tickAt(reminders, due - 5 * MINUTE, due, due + 5 * MINUTE);
    expect(sent.map((each) => each.payload.tag.split(":").slice(2).join(":"))).toEqual(["2026-10-19T07:00:00Z", "2026-10-26T08:00:00Z"]);
  });

  it("follows an occurrence moved on its own to its new time", async () => {
    const series = await create(standup);
    await patch(series.eventId, {
      scope: "this",
      occurrence: "2026-10-26T08:00:00Z",
      changes: { start: "2026-10-27T16:00:00+02:00", end: "2026-10-27T16:30:00+02:00" },
    });
    clock = dues[1]! - 20 * MINUTE;
    const reminders = start();
    await tickAt(reminders, dues[1]! - 5 * MINUTE, dues[1]!, dues[1]! + 5 * MINUTE);
    expect(sent).toEqual([]);
    const moved = at("2026-10-27T13:45:00Z");
    await tickAt(reminders, moved - 5 * MINUTE, moved, moved + 5 * MINUTE);
    expect(titles()).toEqual(["Standup, 16:00"]);
  });
});

describe("an all-day event", () => {
  const nameDay = (date: string, next: string, reminderMinutes: number) => ({
    title: "Name day",
    allDay: true,
    start: date,
    end: next,
    reminderMinutes,
  });

  it("the day before sends at 09:00 the day before in the user's zone, either side of a clock change", async () => {
    // Summer time ends at 04:00 on Sunday 25 October 2026: 09:00 is 06:00Z on the 24th and 07:00Z on the 25th.
    await create(nameDay("2026-10-25", "2026-10-26", 900));
    await create(nameDay("2026-10-26", "2026-10-27", 900));
    clock = at("2026-10-24T05:50:00Z");
    const reminders = start();
    await tickAt(reminders, at("2026-10-24T05:59:00Z"));
    expect(sent).toEqual([]);
    await tickAt(reminders, at("2026-10-24T06:00:00Z"), at("2026-10-24T06:05:00Z"));
    expect(titles()).toEqual(["Name day, tomorrow"]);
    expect(sent[0]?.payload.url).toBe("/almanac/day/2026/10/25");
    await tickAt(reminders, at("2026-10-25T06:50:00Z"), at("2026-10-25T06:59:00Z"));
    expect(sent).toHaveLength(1);
    await tickAt(reminders, at("2026-10-25T07:00:00Z"), at("2026-10-25T07:10:00Z"));
    expect(titles()).toEqual(["Name day, tomorrow", "Name day, tomorrow"]);
    expect(sent[1]?.payload.url).toBe("/almanac/day/2026/10/26");
  });

  it("on the day sends at 09:00 that day, in the user's own zone", async () => {
    const res = await t.inject({ method: "PATCH", url: "/api/settings", payload: { timeZone: "America/New_York" } });
    expect(res.statusCode).toBe(200);
    await create(nameDay("2026-10-27", "2026-10-28", -540));
    clock = at("2026-10-27T12:50:00Z");
    await tickAt(start(), at("2026-10-27T12:59:00Z"), at("2026-10-27T13:00:00Z"));
    expect(titles()).toEqual(["Name day, today"]);
  });
});

describe("due times across the clock changes in Bucharest", () => {
  const BUCHAREST = "Europe/Bucharest";
  const allDay = (start: string, reminderMinutes: number) => ({ allDay: true, start, reminderMinutes });
  const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

  it.each([
    ["the day before a day after summer time starts", "2026-03-30", 900, "2026-03-29T06:00:00.000Z"],
    ["the day before the day summer time starts", "2026-03-29", 900, "2026-03-28T07:00:00.000Z"],
    ["on the day summer time starts", "2026-03-29", -540, "2026-03-29T06:00:00.000Z"],
    ["the day before the day summer time ends", "2026-10-25", 900, "2026-10-24T06:00:00.000Z"],
    ["on the day summer time ends", "2026-10-25", -540, "2026-10-25T07:00:00.000Z"],
    ["the day before a day after summer time ends", "2026-10-26", 900, "2026-10-25T07:00:00.000Z"],
  ])("is 09:00 local %s", (_label, start, minutes, expected) => {
    expect(iso(dueAt(allDay(start, minutes), BUCHAREST))).toBe(expected);
  });

  it("counts a timed reminder back in real time, and has none without one", () => {
    expect(iso(dueAt({ allDay: false, start: "2026-10-25T08:00:00Z", reminderMinutes: 1440 }, BUCHAREST))).toBe("2026-10-24T08:00:00.000Z");
    expect(dueAt({ allDay: false, start: "2026-10-25T08:00:00Z", reminderMinutes: null }, BUCHAREST)).toBeNull();
  });
});

describe("sending once", () => {
  it("two ticks over the same window send once", async () => {
    await create({ ...dentist, reminderMinutes: 10 });
    clock = DENTIST_DUE - MINUTE;
    const reminders = start();
    await tickAt(reminders, DENTIST_DUE, DENTIST_DUE);
    // A second process over the same window, on the same database.
    clock = DENTIST_DUE - MINUTE;
    await tickAt(start(), DENTIST_DUE);
    expect(titles()).toEqual(["Dentist, 14:30"]);
  });

  it("a restart 5 minutes after a reminder fell due sends it; 30 minutes after, not", async () => {
    await create({ ...dentist, reminderMinutes: 10 });
    await create({ ...dentist, title: "Late", start: "2026-10-27T15:00:00+02:00", end: "2026-10-27T16:00:00+02:00", reminderMinutes: 10 });
    // Started 5 minutes after the dentist's reminder fell due (12:20Z): it goes out on the first tick.
    clock = DENTIST_DUE + 5 * MINUTE;
    await tickAt(start(), DENTIST_DUE + 6 * MINUTE);
    expect(titles()).toEqual(["Dentist, 14:30"]);

    // Started 30 minutes after Late's fell due (12:50Z): too stale to send.
    sent = [];
    const lateDue = at("2026-10-27T12:50:00Z");
    clock = lateDue + 30 * MINUTE;
    await tickAt(start(), lateDue + 31 * MINUTE);
    expect(sent).toEqual([]);
  });

  it("skips what fell due while the server was busy for longer than 15 minutes", async () => {
    await create({ ...dentist, reminderMinutes: 10 });
    clock = DENTIST_DUE - 5 * MINUTE;
    const reminders = start();
    await tickAt(reminders, DENTIST_DUE - 4 * MINUTE, DENTIST_DUE + 20 * MINUTE);
    expect(sent).toEqual([]);
  });

  it("drops sent-log rows after a few days", async () => {
    await create({ ...dentist, reminderMinutes: 10 });
    clock = DENTIST_DUE - MINUTE;
    const reminders = start();
    await tickAt(reminders, DENTIST_DUE);
    const count = () => (db.prepare("SELECT COUNT(*) AS n FROM reminders_sent").get() as { n: number }).n;
    expect(count()).toBe(1);
    await tickAt(reminders, DENTIST_DUE + SENT_KEEP_MS - MINUTE);
    expect(count()).toBe(1);
    await tickAt(reminders, DENTIST_DUE + SENT_KEEP_MS + MINUTE);
    expect(count()).toBe(0);
  });
});

describe("what was changed before it fired", () => {
  it("a deleted event sends nothing", async () => {
    const event = await create({ ...dentist, reminderMinutes: 10 });
    clock = DENTIST_DUE - 5 * MINUTE;
    const reminders = start();
    await tickAt(reminders, DENTIST_DUE - 4 * MINUTE);
    expect((await t.inject({ method: "DELETE", url: `/api/events/${event.eventId}` })).statusCode).toBe(204);
    await tickAt(reminders, DENTIST_DUE, DENTIST_DUE + MINUTE);
    expect(sent).toEqual([]);
  });

  it("a moved event sends at its new time only", async () => {
    const event = await create({ ...dentist, reminderMinutes: 10 });
    clock = DENTIST_DUE - 5 * MINUTE;
    const reminders = start();
    await patch(event.eventId, { changes: { start: "2026-10-27T16:00:00+02:00", end: "2026-10-27T17:00:00+02:00" } });
    await tickAt(reminders, DENTIST_DUE, DENTIST_DUE + 5 * MINUTE);
    expect(sent).toEqual([]);
    const moved = at("2026-10-27T13:50:00Z");
    await tickAt(reminders, moved - 5 * MINUTE, moved);
    expect(titles()).toEqual(["Dentist, 16:00"]);
  });

  it("a changed reminder sends at the new time only", async () => {
    const event = await create({ ...dentist, reminderMinutes: 10 });
    clock = DENTIST_DUE - 20 * MINUTE;
    const reminders = start();
    await patch(event.eventId, { changes: { reminderMinutes: 5 } });
    await tickAt(reminders, DENTIST_DUE - 10 * MINUTE, DENTIST_DUE, DENTIST_DUE + 4 * MINUTE);
    expect(sent).toEqual([]);
    await tickAt(reminders, DENTIST_DUE + 5 * MINUTE);
    expect(titles()).toEqual(["Dentist, 14:30"]);
  });
});

describe("who is told", () => {
  it("only users with a subscription, each about their own events", async () => {
    const other = await t.signInAs("other");
    const nobody = await t.signInAs("nobody");
    subscribe("other");
    await create({ ...dentist, reminderMinutes: 10 });
    await create({ ...dentist, title: "Theirs", reminderMinutes: 10 }, other.inject);
    await create({ ...dentist, title: "Unheard", reminderMinutes: 10 }, nobody.inject);
    clock = DENTIST_DUE - MINUTE;
    await tickAt(start(), DENTIST_DUE);
    expect(sent.map((each) => [each.userId, each.payload.title]).sort()).toEqual(
      [
        [userId("owner"), "Dentist, 14:30"],
        [userId("other"), "Theirs, 14:30"],
      ].sort(),
    );
  });
});

describe("the message", () => {
  const occurrence: Occurrence = {
    id: "e1",
    eventId: 1,
    seriesId: null,
    originalStart: null,
    calendarId: 1,
    title: "Dentist",
    location: "",
    notes: "",
    allDay: false,
    start: "2026-12-31T22:30:00Z",
    end: "2026-12-31T23:00:00Z",
    repeat: null,
    reminderMinutes: 120,
  };

  it("says the time on the day, and tomorrow from the day before, in the user's zone", () => {
    // 00:30 on 1 January in Bucharest, two hours before: 22:30 on 31 December.
    expect(reminderPayload(occurrence, at("2026-12-31T20:30:00Z"), "Europe/Bucharest", "/almanac/")).toEqual({
      title: "Dentist, tomorrow at 00:30",
      body: "",
      url: "/almanac/day/2027/1/1",
      tag: "reminder:1:2026-12-31T22:30:00Z",
    });
    expect(reminderPayload(occurrence, at("2026-12-31T20:30:00Z"), "UTC", "/").title).toBe("Dentist, 22:30");
  });

  it("writes the day path unpadded under the base", () => {
    expect(dayPath("/almanac/", "2026-03-05")).toBe("/almanac/day/2026/3/5");
  });
});
