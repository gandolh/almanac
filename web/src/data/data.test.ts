import type { Calendar, CalendarCreate, CalendarPatch, Settings } from "@almanac/shared";
import { DEFAULT_TIME_ZONE } from "@almanac/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { calendarColor, createCalendarsStore, sortCalendars, type CalendarsSource } from "./calendars";
import { createSettingsStore } from "./settings";
import { createResource, createStore, resetWhenSignedOut, useStore } from "./store";

function makeCalendar(id: number, name: string, extra: Partial<Calendar> = {}): Calendar {
  return {
    id,
    name,
    color: "blue",
    visible: true,
    position: id,
    createdAt: "2026-10-16T09:00:00Z",
    updatedAt: "2026-10-16T09:00:00Z",
    ...extra,
  };
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A fake server over `rows`; `list` answers at once unless a test queues its own answers. */
function fakeSource(initial: Calendar[]) {
  let rows = [...initial];
  let nextId = Math.max(0, ...initial.map((c) => c.id)) + 1;
  const lists: ReturnType<typeof deferred<Calendar[]>>[] = [];
  const failNext: { patch?: ApiError; remove?: ApiError } = {};
  const source: CalendarsSource = {
    list: vi.fn(() => {
      const queued = lists.shift();
      return queued ? queued.promise : Promise.resolve([...rows]);
    }),
    create: vi.fn(async (body: CalendarCreate) => {
      const calendar = makeCalendar(nextId, body.name, { position: nextId, color: body.color ?? "teal" });
      nextId += 1;
      rows.push(calendar);
      return calendar;
    }),
    patch: vi.fn(async (id: number, patch: CalendarPatch) => {
      if (failNext.patch) {
        const error = failNext.patch;
        delete failNext.patch;
        throw error;
      }
      const row = rows.find((c) => c.id === id);
      if (!row) throw new ApiError(404, "not_found", "No such calendar.");
      const saved = { ...row, ...patch, updatedAt: "2026-10-16T10:00:00Z" } as Calendar;
      rows = rows.map((c) => (c.id === id ? saved : c));
      return saved;
    }),
    remove: vi.fn(async (id: number) => {
      if (failNext.remove) {
        const error = failNext.remove;
        delete failNext.remove;
        throw error;
      }
      if (!rows.some((c) => c.id === id)) throw new ApiError(404, "not_found", "No such calendar.");
      rows = rows.filter((c) => c.id !== id);
    }),
  };
  return { source, lists, failNext, rows: () => rows };
}

describe("createStore", () => {
  it("holds a value and tells its listeners about changes only", () => {
    const store = createStore(1);
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    store.setState(2);
    store.setState((n) => n + 1);
    store.setState(3);
    expect(store.getState()).toBe(3);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    store.setState(4);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("renders its value on the server", () => {
    const store = createStore("hello");
    function Show() {
      return createElement("p", null, useStore(store));
    }
    expect(renderToStaticMarkup(createElement(Show))).toBe("<p>hello</p>");
  });
});

describe("createResource", () => {
  it("loads once, and keeps the value when a refresh fails", async () => {
    const load = vi.fn<() => Promise<number>>().mockResolvedValueOnce(5).mockRejectedValueOnce(new ApiError(0, "network", "Offline."));
    const resource = createResource(load, 0, "Failed.");
    expect(resource.store.getState()).toEqual({ value: 0, status: "loading", error: null });
    resource.ensureLoaded();
    resource.ensureLoaded();
    await resource.refresh();
    expect(load).toHaveBeenCalledTimes(1);
    expect(resource.store.getState()).toEqual({ value: 5, status: "ready", error: null });
    await resource.refresh();
    expect(resource.store.getState().value).toBe(5);
    expect(resource.store.getState().status).toBe("ready");
    expect(resource.store.getState().error?.code).toBe("network");
  });

  it("reports a first load that fails, and wraps errors that aren't the API's", async () => {
    const resource = createResource(() => Promise.reject(new TypeError("boom")), 0, "The thing couldn't be loaded.");
    await resource.refresh();
    expect(resource.store.getState().status).toBe("error");
    expect(resource.store.getState().error?.message).toBe("The thing couldn't be loaded.");
  });

  it("replays a change made while a fetch is in flight onto its answer", async () => {
    const answer = deferred<number[]>();
    const resource = createResource<number[]>(() => answer.promise, [], "Failed.");
    const loading = resource.refresh();
    resource.apply((list) => [...list, 9]);
    answer.resolve([1, 2]);
    await loading;
    expect(resource.store.getState().value).toEqual([1, 2, 9]);
  });

  it("drops the answer to a fetch from before a reset", async () => {
    const answer = deferred<number>();
    const resource = createResource(() => answer.promise, 0, "Failed.");
    const loading = resource.refresh();
    resource.reset();
    answer.resolve(7);
    await loading;
    expect(resource.store.getState()).toEqual({ value: 0, status: "loading", error: null });
  });
});

describe("resetWhenSignedOut", () => {
  it("resets when the session turns signed out, once", () => {
    let status = "signed_in";
    const listeners = new Set<() => void>();
    const session = {
      getState: () => ({ status }),
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const reset = vi.fn();
    resetWhenSignedOut(reset, session);
    const become = (next: string) => {
      status = next;
      for (const listener of listeners) listener();
    };
    become("signed_in");
    expect(reset).not.toHaveBeenCalled();
    become("signed_out");
    become("signed_out");
    expect(reset).toHaveBeenCalledTimes(1);
    become("signed_in");
    become("signed_out");
    expect(reset).toHaveBeenCalledTimes(2);
  });
});

describe("the calendars store", () => {
  const work = makeCalendar(2, "Work", { position: 1, color: "teal" });
  const personal = makeCalendar(1, "Personal", { position: 0 });

  it("loads the list in the left column's order", async () => {
    const { source } = fakeSource([work, personal]);
    const store = createCalendarsStore(source);
    await store.resource.refresh();
    expect(store.resource.store.getState().value.map((c) => c.name)).toEqual(["Personal", "Work"]);
  });

  it("adds a created calendar at its place", async () => {
    const { source } = fakeSource([personal, work]);
    const store = createCalendarsStore(source);
    await store.resource.refresh();
    const gym = await store.create({ name: "Gym", color: "green" });
    expect(gym.name).toBe("Gym");
    expect(store.resource.store.getState().value.map((c) => c.name)).toEqual(["Personal", "Work", "Gym"]);
  });

  it("shows a change at once and keeps the server's answer", async () => {
    const { source } = fakeSource([personal, work]);
    const store = createCalendarsStore(source);
    await store.resource.refresh();
    const saving = store.update(2, { visible: false });
    expect(store.resource.store.getState().value.find((c) => c.id === 2)?.visible).toBe(false);
    const saved = await saving;
    expect(saved.updatedAt).toBe("2026-10-16T10:00:00Z");
    expect(store.resource.store.getState().value.find((c) => c.id === 2)).toEqual(saved);
  });

  it("puts a refused change back and rethrows", async () => {
    const { source, failNext } = fakeSource([personal, work]);
    const store = createCalendarsStore(source);
    await store.resource.refresh();
    failNext.patch = new ApiError(400, "validation", "name: a calendar needs a name");
    await expect(store.update(2, { name: " ", color: "red" })).rejects.toMatchObject({ code: "validation" });
    expect(store.resource.store.getState().value.find((c) => c.id === 2)).toEqual(work);
  });

  it("removes a deleted calendar, and one already gone", async () => {
    const { source } = fakeSource([personal, work]);
    const store = createCalendarsStore(source);
    await store.resource.refresh();
    await store.remove(2);
    expect(store.resource.store.getState().value.map((c) => c.id)).toEqual([1]);
    await store.remove(2);
    expect(store.resource.store.getState().value.map((c) => c.id)).toEqual([1]);
  });

  it("keeps the last calendar when the server refuses to delete it", async () => {
    const { source, failNext } = fakeSource([personal]);
    const store = createCalendarsStore(source);
    await store.resource.refresh();
    failNext.remove = new ApiError(409, "conflict", "You need at least one calendar.");
    await expect(store.remove(1)).rejects.toMatchObject({ status: 409, code: "conflict" });
    expect(store.resource.store.getState().value).toEqual([personal]);
  });

  it("sorts by position, then id, and colours from the palette", () => {
    const a = makeCalendar(3, "A", { position: 0 });
    const b = makeCalendar(1, "B", { position: 0 });
    expect(sortCalendars([work, a, b]).map((c) => c.id)).toEqual([1, 3, 2]);
    expect(calendarColor(work)).toBe("#009688");
    expect(calendarColor(personal)).toBe("#4285F4");
  });
});

describe("the settings store", () => {
  it("starts at the default zone and follows the server", async () => {
    let saved: Settings = { timeZone: "Europe/London" };
    const store = createSettingsStore({
      get: async () => saved,
      patch: async (patch) => {
        saved = { timeZone: patch.timeZone ?? saved.timeZone };
        return saved;
      },
    });
    expect(store.resource.store.getState().value.timeZone).toBe(DEFAULT_TIME_ZONE);
    await store.resource.refresh();
    expect(store.resource.store.getState().value.timeZone).toBe("Europe/London");
    await store.setTimeZone("America/New_York");
    expect(store.resource.store.getState().value.timeZone).toBe("America/New_York");
  });

  it("keeps the zone when the server refuses a new one", async () => {
    const store = createSettingsStore({
      get: async () => ({ timeZone: "Europe/Bucharest" }),
      patch: async () => {
        throw new ApiError(400, "validation", "timeZone: must be an IANA time zone");
      },
    });
    await store.resource.refresh();
    await expect(store.setTimeZone("Mars/Olympus")).rejects.toMatchObject({ code: "validation" });
    expect(store.resource.store.getState().value.timeZone).toBe("Europe/Bucharest");
  });
});
