import type { Occurrence } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { createEvent, deleteEvent, fetchOccurrences, notifyOccurrencesChanged, onOccurrencesChanged, updateEvent } from "./occurrences";

const standup: Occurrence = {
  id: "e1",
  eventId: 1,
  seriesId: null,
  originalStart: null,
  calendarId: 3,
  title: "Standup",
  location: "",
  notes: "",
  allDay: false,
  start: "2026-10-16T07:00:00Z",
  end: "2026-10-16T07:15:00Z",
  repeat: null,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

let calls: { url: string; method: string; body: unknown }[];
let changes: number;
let stop: () => void;

function serve(handler: (url: string, init: RequestInit) => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
      return handler(url, init);
    }),
  );
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

beforeEach(() => {
  calls = [];
  changes = 0;
  stop = onOccurrencesChanged(() => {
    changes += 1;
  });
});

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

describe("fetchOccurrences", () => {
  it("asks for the range and checks the answer", async () => {
    serve(() => json(200, { occurrences: [standup] }));
    const found = await fetchOccurrences("2026-10-11T21:00:00Z", "2026-10-18T21:00:00Z");
    expect(found).toEqual([standup]);
    expect(calls[0]?.url).toBe("/almanac-api/api/occurrences?from=2026-10-11T21%3A00%3A00Z&to=2026-10-18T21%3A00%3A00Z");
    expect(changes).toBe(0);
  });

  it("refuses an answer that isn't a list of occurrences", async () => {
    serve(() => json(200, { occurrences: [{ ...standup, start: "tomorrow" }] }));
    expect((await failure(fetchOccurrences("2026-10-11T21:00:00Z", "2026-10-18T21:00:00Z"))).code).toBe("bad_response");
  });
});

describe("the writes", () => {
  it("create sends the checked event and tells the views", async () => {
    serve(() => json(201, standup));
    const created = await createEvent({
      calendarId: 3,
      title: "  Standup ",
      allDay: false,
      start: "2026-10-16T10:00:00+03:00",
      end: "2026-10-16T10:15:00+03:00",
    });
    expect(created).toEqual(standup);
    expect(calls[0]).toMatchObject({ url: "/almanac-api/api/events", method: "POST" });
    // Trimmed, defaulted and in the wire's form, as the schema leaves it.
    expect(calls[0]?.body).toEqual({
      calendarId: 3,
      title: "Standup",
      location: "",
      notes: "",
      allDay: false,
      start: "2026-10-16T07:00:00Z",
      end: "2026-10-16T07:15:00Z",
      repeat: null,
    });
    expect(changes).toBe(1);
  });

  it("refuses an event the server would refuse, without sending it or telling anyone", async () => {
    serve(() => json(201, standup));
    const error = await failure(
      createEvent({ calendarId: 3, title: "Standup", allDay: false, start: "2026-10-16T07:00:00Z", end: "2026-10-16T07:00:00Z" }),
    );
    expect(error).toMatchObject({ status: 400, code: "validation", message: "end: must be after the start" });
    expect(calls).toHaveLength(0);
    expect(changes).toBe(0);
  });

  it("update sends the scope, the occurrence and the changes", async () => {
    serve(() => json(200, { ...standup, id: "e9", eventId: 9, seriesId: 7, originalStart: "2026-10-16T07:00:00Z" }));
    await updateEvent(7, {
      scope: "this",
      occurrence: "2026-10-16T07:00:00Z",
      changes: { start: "2026-10-16T08:00:00Z", end: "2026-10-16T08:15:00Z" },
    });
    expect(calls[0]).toEqual({
      url: "/almanac-api/api/events/7",
      method: "PATCH",
      body: { scope: "this", occurrence: "2026-10-16T07:00:00Z", changes: { start: "2026-10-16T08:00:00Z", end: "2026-10-16T08:15:00Z" } },
    });
    expect(changes).toBe(1);
  });

  it("a refused update tells nobody", async () => {
    serve(() => json(400, { error: { code: "validation", message: "scope: a series needs a scope" } }));
    const error = await failure(updateEvent(7, { changes: { title: "Retro" } }));
    expect(error).toMatchObject({ status: 400, code: "validation", message: "scope: a series needs a scope" });
    expect(changes).toBe(0);
  });

  it("delete puts the scope and occurrence in the query", async () => {
    serve(() => new Response(null, { status: 204 }));
    await deleteEvent(7, { scope: "following", occurrence: "2026-10-16T07:00:00Z" });
    await deleteEvent(1);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "DELETE /almanac-api/api/events/7?scope=following&occurrence=2026-10-16T07%3A00%3A00Z",
      "DELETE /almanac-api/api/events/1",
    ]);
    expect(changes).toBe(2);
  });

  it("refuses a scope that isn't one", async () => {
    serve(() => new Response(null, { status: 204 }));
    const error = await failure(deleteEvent(7, { scope: "some" as "all" }));
    expect(error.code).toBe("validation");
    expect(calls).toHaveLength(0);
  });
});

describe("onOccurrencesChanged", () => {
  it("stops after unsubscribing, and hears a notification sent by hand", () => {
    let heard = 0;
    const unsubscribe = onOccurrencesChanged(() => {
      heard += 1;
    });
    notifyOccurrencesChanged();
    unsubscribe();
    notifyOccurrencesChanged();
    expect(heard).toBe(1);
    expect(changes).toBe(2);
  });
});
