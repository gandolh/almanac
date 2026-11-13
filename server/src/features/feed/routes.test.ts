import { Writable } from "node:stream";
import {
  calendarListSchema,
  feedLinkSchema,
  feedStateSchema,
  occurrenceListSchema,
  occurrenceSchema,
  type FeedState,
  type Occurrence,
} from "@almanac/shared";
import ICAL from "ical.js";
import type { InjectOptions, LightMyRequestResponse } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOG_REDACT } from "../../lib/log.js";
import { featureApp } from "../../testing/featureApp.js";
import { startSignedInApp, startTestApp, type SignedInTestApp } from "../../testing/testApp.js";
import type { EventStore } from "../events/index.js";
import type { SettingsStore } from "../settings/index.js";
import { FEED_RATE_LIMIT, feedRoutes } from "./routes.js";
import type { FeedTokenStore } from "./store.js";

type Inject = (options: InjectOptions) => Promise<LightMyRequestResponse>;

let t: SignedInTestApp;

beforeEach(async () => {
  t = await startSignedInApp();
});

afterEach(async () => {
  await t.close();
});

/** The feed's path in the app, from the link the server made (which carries the API prefix). */
function feedPath(url: string): string {
  return new URL(url).pathname.replace(/^\/almanac-api/, "");
}

async function turnOn(inject: Inject = t.inject): Promise<{ url: string; path: string; createdAt: string }> {
  const res = await inject({ method: "POST", url: "/api/feed" });
  expect(res.statusCode, res.body).toBe(201);
  const link = feedLinkSchema.parse(res.json());
  return { ...link, path: feedPath(link.url) };
}

async function state(inject: Inject = t.inject): Promise<FeedState> {
  const res = await inject({ method: "GET", url: "/api/feed" });
  expect(res.statusCode).toBe(200);
  return feedStateSchema.parse(res.json());
}

/** The feed as a calendar app fetches it: no cookie, nothing but the link. */
const fetchFeed = (path: string, headers: Record<string, string> = {}) =>
  t.app.inject({ method: "GET", url: path, headers });

async function calendarIdOf(inject: Inject): Promise<number> {
  const res = await inject({ method: "GET", url: "/api/calendars" });
  return calendarListSchema.parse(res.json()).calendars[0]?.id ?? 0;
}

async function create(payload: object, inject: Inject = t.inject): Promise<Occurrence> {
  const res = await inject({ method: "POST", url: "/api/events", payload });
  expect(res.statusCode, res.body).toBe(201);
  return occurrenceSchema.parse(res.json());
}

const NOT_FOUND = { error: { code: "not_found", message: "There is no such route." } };

describe("the feed's state and link", () => {
  it("is off until turned on, then on with the link shown once", async () => {
    expect(await state()).toEqual({ on: false, createdAt: null });
    const link = await turnOn();
    expect(link.url).toMatch(/^http:\/\/localhost:5177\/almanac-api\/api\/feed\/[A-Za-z0-9_-]{43}\/almanac\.ics$/);
    expect(await state()).toEqual({ on: true, createdAt: link.createdAt });
    // The state never carries the link: the server can't make it again.
    expect(JSON.stringify(await state())).not.toContain(link.path.split("/")[3]);
  });

  it("answers a new link with no-store, so no cache keeps the secret", async () => {
    const res = await t.inject({ method: "POST", url: "/api/feed" });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("needs a session for the state, a new link and off", async () => {
    for (const method of ["GET", "POST", "DELETE"] as const) {
      expect((await t.app.inject({ method, url: "/api/feed" })).statusCode).toBe(401);
    }
  });

  it("refuses a new link or off from another origin", async () => {
    for (const method of ["POST", "DELETE"] as const) {
      const res = await t.inject({ method, url: "/api/feed", headers: { origin: "https://elsewhere.example" } });
      expect(res.statusCode).toBe(403);
    }
  });
});

describe("GET /api/feed/:token/almanac.ics", () => {
  it("answers the calendar to a request with no cookie, with headers for calendar apps and none for CORS", async () => {
    await create({
      calendarId: await calendarIdOf(t.inject),
      title: "Dentist",
      allDay: false,
      start: "2026-10-20T05:30:00Z",
      end: "2026-10-20T06:30:00Z",
      reminderMinutes: 15,
    });
    const { path } = await turnOn();
    const res = await fetchFeed(path, { origin: "https://elsewhere.example" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/calendar; charset=utf-8");
    expect(res.headers["cache-control"]).toBe("private, no-cache");
    expect(res.headers.etag).toMatch(/^"[A-Za-z0-9_-]{43}"$/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(Object.keys(res.headers).filter((name) => name.startsWith("access-control-"))).toEqual([]);
    expect(res.body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(res.body).toContain("SUMMARY:Dentist\r\n");
    expect(res.body).not.toContain("VALARM");
  });

  it("ignores a session cookie sent along, and never renews it", async () => {
    const { path } = await turnOn();
    const res = await t.inject({ method: "GET", url: path });
    expect(res.statusCode).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("answers 304 to a matching If-None-Match, and a new ETag once an event changes", async () => {
    const calendarId = await calendarIdOf(t.inject);
    const event = await create({
      calendarId,
      title: "Yoga",
      allDay: false,
      start: "2026-10-24T07:00:00Z",
      end: "2026-10-24T08:00:00Z",
    });
    const { path } = await turnOn();
    const first = await fetchFeed(path);
    const etag = String(first.headers.etag);
    expect((await fetchFeed(path)).headers.etag).toBe(etag);

    const unchanged = await fetchFeed(path, { "if-none-match": etag });
    expect(unchanged.statusCode).toBe(304);
    expect(unchanged.body).toBe("");
    expect(unchanged.headers.etag).toBe(etag);
    expect((await fetchFeed(path, { "if-none-match": `W/${etag}, "other"` })).statusCode).toBe(304);
    expect((await fetchFeed(path, { "if-none-match": '"other"' })).statusCode).toBe(200);

    const res = await t.inject({
      method: "PATCH",
      url: `/api/events/${event.eventId}`,
      payload: { changes: { title: "Yoga, longer" } },
    });
    expect(res.statusCode, res.body).toBe(200);
    const changed = await fetchFeed(path, { "if-none-match": etag });
    expect(changed.statusCode).toBe(200);
    expect(changed.headers.etag).not.toBe(etag);
    expect(changed.body).toContain("SUMMARY:Yoga\\, longer\r\n");
  });

  it("answers HEAD with the headers and no body", async () => {
    const { path } = await turnOn();
    const res = await t.app.inject({ method: "HEAD", url: path });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/calendar; charset=utf-8");
    expect(res.body).toBe("");
  });

  it("answers one plain 404 for a token that is malformed, unknown, replaced or turned off", async () => {
    const first = await turnOn();
    const second = await turnOn();
    const token = second.path.split("/")[3] ?? "";
    const unknownRoute = await t.app.inject({ method: "GET", url: "/api/nothing-here" });

    const wrong = [
      first.path, // replaced by the second link
      second.path.replace(token, `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`),
      second.path.replace(token, token.slice(1)),
      second.path.replace(token, `${token}x`),
      second.path.replace(token, "not a token"),
      second.path.replace(token, "%00"),
    ];
    for (const path of wrong) {
      const res = await fetchFeed(path);
      expect(res.statusCode, path).toBe(404);
      expect(res.json()).toEqual(NOT_FOUND);
      expect(res.headers["content-type"]).toBe(unknownRoute.headers["content-type"]);
    }
    expect((await fetchFeed(second.path)).statusCode).toBe(200);

    const off = await t.inject({ method: "DELETE", url: "/api/feed" });
    expect(off.statusCode).toBe(204);
    expect(await state()).toEqual({ on: false, createdAt: null });
    expect((await fetchFeed(second.path)).json()).toEqual(NOT_FOUND);
    // Off twice is still off.
    expect((await t.inject({ method: "DELETE", url: "/api/feed" })).statusCode).toBe(204);
  });

  it("answers only GET: any other method finds no route, and without a session the sign-in guard refuses it", async () => {
    const { path } = await turnOn();
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const res = await t.app.inject({ method, url: path });
      expect(res.statusCode, method).toBe(401);
      expect(res.body).not.toContain("BEGIN:VCALENDAR");
    }
    // With a session, there is simply no such route.
    expect((await t.inject({ method: "POST", url: path })).statusCode).toBe(404);
  });

  it("never shows one user's events in another's feed", async () => {
    const other = await t.signInAs("other");
    await create({
      calendarId: await calendarIdOf(t.inject),
      title: "Owner's dentist",
      allDay: false,
      start: "2026-10-20T05:30:00Z",
      end: "2026-10-20T06:30:00Z",
    });
    await create(
      {
        calendarId: await calendarIdOf(other.inject),
        title: "Other's lunch",
        allDay: true,
        start: "2026-10-21",
        end: "2026-10-22",
        repeat: { freq: "weekly", end: { type: "never" } },
      },
      other.inject,
    );
    const mine = await turnOn();
    const theirs = await turnOn(other.inject);

    const myFeed = (await fetchFeed(mine.path)).body;
    const theirFeed = (await fetchFeed(theirs.path)).body;
    expect(myFeed).toContain("SUMMARY:Owner's dentist");
    expect(myFeed).not.toContain("Other's lunch");
    expect(theirFeed).toContain("SUMMARY:Other's lunch");
    expect(theirFeed).not.toContain("Owner's dentist");

    // A new link for one user leaves the other's working.
    await turnOn(other.inject);
    expect((await fetchFeed(theirs.path)).statusCode).toBe(404);
    expect((await fetchFeed(mine.path)).body).toBe(myFeed);
  });

  it("answers 429 rate_limited past its limit for one address", async () => {
    const { path } = await turnOn();
    for (let i = 0; i < FEED_RATE_LIMIT.max; i++) {
      expect((await fetchFeed(path)).statusCode).toBe(200);
    }
    const limited = await fetchFeed(path);
    expect(limited.statusCode).toBe(429);
    expect(limited.json<{ error: { code: string } }>().error.code).toBe("rate_limited");
    expect(limited.headers["retry-after"]).toBeDefined();
    // Guessing tokens counts against the same limit.
    expect((await fetchFeed(path.replace(/feed\/[^/]+/, "feed/guess"))).statusCode).toBe(429);
    // Another address has its own.
    expect((await t.app.inject({ method: "GET", url: path, remoteAddress: "192.0.2.7" })).statusCode).toBe(200);
  });
});

describe("the feed's token in the log", () => {
  it("is replaced in every line the process logs", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logged = await startTestApp({}, { server: { logger: { level: "info", stream, redact: LOG_REDACT } } });
    try {
      const cookie = await logged.signIn();
      const res = await logged.app.inject({ method: "POST", url: "/api/feed", headers: { cookie } });
      const { url } = feedLinkSchema.parse(res.json());
      const path = feedPath(url);
      const token = path.split("/")[3] ?? "";
      expect((await logged.app.inject({ method: "GET", url: path })).statusCode).toBe(200);
      expect((await logged.app.inject({ method: "GET", url: `${path.slice(0, -4)}` })).statusCode).toBe(401);
      const log = lines.join("");
      expect(log).toContain('"url":"/api/feed/<token>/almanac.ics"');
      expect(token).toHaveLength(43);
      expect(log).not.toContain(token);
    } finally {
      await logged.close();
    }
  });
});

/** One occurrence as both sides can say it: a date for an all-day one, else a UTC instant. */
interface Seen {
  title: string;
  start: string;
  end: string;
}

const byStart = (a: Seen, b: Seen) => (a.start === b.start ? (a.title < b.title ? -1 : 1) : a.start < b.start ? -1 : 1);

function timeOf(time: ICAL.Time): string {
  return time.isDate ? time.toString() : `${time.toJSDate().toISOString().slice(0, 19)}Z`;
}

/** The feed's occurrences overlapping the week, expanded by ical.js from the feed's own rules and zones. */
function expandWithIcalJs(text: string, from: string, to: string, dates: readonly [string, string]): Seen[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const zone of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(zone);
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const vevent of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  for (const exception of exceptions) masters.get(exception.uid)?.relateException(exception);

  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const overlaps = (start: ICAL.Time, end: ICAL.Time) =>
    start.isDate
      ? start.toString() < dates[1] && end.toString() > dates[0]
      : start.toJSDate().getTime() < toMs && end.toJSDate().getTime() > fromMs;

  const seen: Seen[] = [];
  for (const event of masters.values()) {
    if (!event.isRecurring()) {
      if (overlaps(event.startDate, event.endDate))
        seen.push({ title: event.summary, start: timeOf(event.startDate), end: timeOf(event.endDate) });
      continue;
    }
    const iterator = event.iterator();
    for (let next = iterator.next(); next; next = iterator.next()) {
      // Two days past the week covers an exception moved back into it.
      if (next.toJSDate().getTime() > toMs + 2 * 86_400_000) break;
      const { item, startDate, endDate } = event.getOccurrenceDetails(next);
      if (overlaps(startDate, endDate))
        seen.push({ title: item.summary, start: timeOf(startDate), end: timeOf(endDate) });
    }
  }
  return seen.sort(byStart);
}

describe("the feed against a fixture week", () => {
  /** Monday 19 to Sunday 25 October 2026 in Bucharest; the clocks go back on the Sunday morning. */
  const FROM = "2026-10-19T00:00:00+03:00";
  const TO = "2026-10-26T00:00:00+02:00";
  const DATES = ["2026-10-19", "2026-10-26"] as const;

  async function seedWeek(): Promise<void> {
    const calendarId = await calendarIdOf(t.inject);
    // A second calendar, hidden: the feed holds every calendar.
    const hidden = await t.inject({
      method: "POST",
      url: "/api/calendars",
      payload: { name: "Hidden", color: "green" },
    });
    const hiddenId = Number(hidden.json<{ id: number }>().id);
    await t.inject({ method: "PATCH", url: `/api/calendars/${hiddenId}`, payload: { visible: false } });

    const standup = await create({
      calendarId,
      title: "Team standup; daily, \\ quick",
      allDay: false,
      start: "2026-10-05T06:30:00Z",
      end: "2026-10-05T07:00:00Z",
      repeat: { freq: "weekdays", end: { type: "never" } },
      reminderMinutes: 10,
    });
    const moved = await t.inject({
      method: "PATCH",
      url: `/api/events/${standup.eventId}`,
      payload: {
        scope: "this",
        occurrence: "2026-10-21T06:30:00Z",
        changes: { title: "Standup, moved", start: "2026-10-21T08:00:00Z", end: "2026-10-21T08:30:00Z" },
      },
    });
    expect(moved.statusCode, moved.body).toBe(200);
    const deleted = await t.inject({
      method: "DELETE",
      url: `/api/events/${standup.eventId}?scope=this&occurrence=2026-10-22T06:30:00Z`,
    });
    expect(deleted.statusCode, deleted.body).toBe(204);

    // Every day at 07:00 in Bucharest, ten times: the last two are after the clocks go back.
    await create({
      calendarId: hiddenId,
      title: "Run",
      allDay: false,
      start: "2026-10-19T04:00:00Z",
      end: "2026-10-19T04:45:00Z",
      repeat: { freq: "daily", end: { type: "count", count: 10 } },
    });
    await create({
      calendarId,
      title: "Market",
      allDay: true,
      start: "2026-10-03",
      end: "2026-10-04",
      repeat: { freq: "weekly", byDay: ["SA"], end: { type: "until", date: "2026-12-31" } },
    });
    await create({
      calendarId,
      title: "Dentist",
      location: "Str. Ștefan cel Mare 1, ap. 2; et. 3",
      notes: "Bring the card\r\nBEGIN:VALARM\r\nTRIGGER:-PT5M",
      allDay: false,
      start: "2026-10-20T05:30:00Z",
      end: "2026-10-20T06:30:00Z",
      reminderMinutes: 15,
    });
    await create({ calendarId, title: "Anniversary", allDay: true, start: "2026-10-22", end: "2026-10-23" });
    await create({ calendarId: hiddenId, title: "Trip", allDay: true, start: "2026-10-23", end: "2026-10-26" });
    await create({
      calendarId,
      title: "Ședință de planificare, trimestrul IV; bugetul și echipa — împreună cu toți colegii din București",
      allDay: false,
      start: "2026-10-23T11:00:00Z",
      end: "2026-10-23T12:30:00Z",
    });
  }

  it("holds what GET /api/occurrences answers for the week, as ical.js expands it", async () => {
    await seedWeek();
    const listed = await t.inject({
      method: "GET",
      url: `/api/occurrences?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`,
    });
    expect(listed.statusCode, listed.body).toBe(200);
    const expected = occurrenceListSchema
      .parse(listed.json())
      .occurrences.map(({ title, start, end }) => ({ title, start, end }))
      .sort(byStart);
    expect(expected.map((occurrence) => occurrence.title)).toContain("Standup, moved");
    expect(expected).toContainEqual({ title: "Run", start: "2026-10-25T05:00:00Z", end: "2026-10-25T05:45:00Z" });
    expect(expected).toHaveLength(16);

    const { path } = await turnOn();
    const text = (await fetchFeed(path)).body;
    expect(expandWithIcalJs(text, FROM, TO, DATES)).toEqual(expected);
  });

  it("is well-formed: CRLF lines of at most 75 octets, folded only between characters, and no alarm", async () => {
    await seedWeek();
    const { path } = await turnOn();
    const text = (await fetchFeed(path)).body;
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    const lines = text.split("\r\n").slice(0, -1);
    for (const line of lines) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
      expect(line).not.toMatch(/[\r\n]/);
      expect(line).not.toContain("�");
    }
    expect(lines.some((line) => line.startsWith(" "))).toBe(true);
    const unfolded = text.replace(/\r\n /g, "");
    expect(unfolded).not.toMatch(/^BEGIN:VALARM/m);
    expect(unfolded).toContain("LOCATION:Str. Ștefan cel Mare 1\\, ap. 2\\; et. 3\r\n");
    expect(unfolded).toContain("DESCRIPTION:Bring the card\\nBEGIN:VALARM\\nTRIGGER:-PT5M\r\n");
    expect(unfolded).toContain("SUMMARY:Team standup\\; daily\\, \\\\ quick\r\n");

    // ical.js reads the text back as it was typed.
    const root = new ICAL.Component(ICAL.parse(text));
    const dentist = root.getAllSubcomponents("vevent").find((v) => v.getFirstPropertyValue("summary") === "Dentist");
    expect(dentist?.getFirstPropertyValue("description")).toBe("Bring the card\nBEGIN:VALARM\nTRIGGER:-PT5M");
    expect(root.getAllSubcomponents("vevent").flatMap((v) => v.getAllSubcomponents("valarm"))).toEqual([]);

    // The same rows give the same UIDs, and the same bytes.
    expect((await fetchFeed(path)).body).toBe(text);
  });
});

describe("the reply schema", () => {
  const stores = (feedTokens: Partial<FeedTokenStore>) =>
    featureApp(feedRoutes, {
      config: { publicOrigin: "http://localhost:5177", apiPrefix: "/almanac-api" },
      events: {} as EventStore,
      settings: {} as SettingsStore,
      feedTokens: feedTokens as FeedTokenStore,
    });

  it("strips a field the schema doesn't name", async () => {
    const bare = await stores({ state: () => ({ on: true, createdAt: "2026-11-13T12:00:00.000Z", tokenHash: "x" }) });
    const res = await bare.inject({ method: "GET", url: "/api/feed" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('{"on":true,"createdAt":"2026-11-13T12:00:00.000Z"}');
    await bare.close();
  });

  it("answers 500 with the fixed message, and no detail, for a reply that fails it", async () => {
    const bare = await stores({ replace: () => 42 as unknown as string });
    const res = await bare.inject({ method: "POST", url: "/api/feed" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: "internal", message: "Something went wrong on the server." } });
    await bare.close();
  });
});
