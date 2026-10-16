import {
  CALENDAR_COLORS,
  calendarListSchema,
  calendarSchema,
  type Calendar,
  type CalendarColor,
  type CalendarCreate,
  type CalendarPatch,
} from "@almanac/shared";
import { useEffect, useMemo } from "react";
import { apiRequest, isApiError, type ApiError } from "../api";
import { authClient } from "../auth/session";
import { createResource, resetWhenSignedOut, useStore, type LoadStatus } from "./store";

/**
 * The user's calendars (brief 03's routes): `GET /api/calendars` once per
 * session, kept in memory in the left column's order, and every change made
 * through `useCalendars()` applied in place so the left column and every view
 * re-render at once. A patch shows straight away and is undone if the server
 * refuses it (the show/hide checkbox must not wait for the network).
 */

/** The calls the store makes; `calendarsApi` in the app, a fake in tests. */
export interface CalendarsSource {
  list(): Promise<Calendar[]>;
  create(body: CalendarCreate): Promise<Calendar>;
  patch(id: number, patch: CalendarPatch): Promise<Calendar>;
  remove(id: number): Promise<void>;
}

export const calendarsApi: CalendarsSource = {
  list: () => apiRequest("/api/calendars", { schema: calendarListSchema }).then((answer) => answer.calendars),
  create: (body) => apiRequest("/api/calendars", { method: "POST", body, schema: calendarSchema }),
  patch: (id, patch) => apiRequest(`/api/calendars/${id}`, { method: "PATCH", body: patch, schema: calendarSchema }),
  remove: (id) => apiRequest(`/api/calendars/${id}`, { method: "DELETE" }),
};

/** By `position`, then `id`: the left column's order. */
export function sortCalendars(calendars: readonly Calendar[]): readonly Calendar[] {
  return [...calendars].sort((a, b) => a.position - b.position || a.id - b.id);
}

function upsert(calendars: readonly Calendar[], calendar: Calendar): readonly Calendar[] {
  const others = calendars.filter((each) => each.id !== calendar.id);
  return sortCalendars([...others, calendar]);
}

/** The fields a patch sets, without the ones left `undefined`. */
function changesOf(patch: CalendarPatch): Partial<Pick<Calendar, "name" | "color" | "visible">> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

export function createCalendarsStore(source: CalendarsSource) {
  const resource = createResource<readonly Calendar[]>(
    () => source.list().then(sortCalendars),
    [],
    "Your calendars couldn't be loaded.",
  );
  const replace = (id: number, change: (calendar: Calendar) => Calendar) =>
    resource.apply((calendars) => calendars.map((each) => (each.id === id ? change(each) : each)));

  return {
    resource,

    /** `POST /api/calendars`; the new calendar joins the list. Rejects with an `ApiError`. */
    async create(body: CalendarCreate): Promise<Calendar> {
      const calendar = await source.create(body);
      resource.apply((calendars) => upsert(calendars, calendar));
      return calendar;
    },

    /**
     * `PATCH /api/calendars/:id`. The change shows at once; the server's
     * answer then replaces the row, or, when it refuses, the changed fields
     * go back to what they were and the `ApiError` is rethrown.
     */
    async update(id: number, patch: CalendarPatch): Promise<Calendar> {
      const changes = changesOf(patch);
      const before = resource.store.getState().value.find((each) => each.id === id);
      replace(id, (calendar) => ({ ...calendar, ...changes }));
      try {
        const calendar = await source.patch(id, patch);
        resource.apply((calendars) => upsert(calendars, calendar));
        return calendar;
      } catch (error) {
        if (before !== undefined) {
          const undo = Object.fromEntries(Object.keys(changes).map((key) => [key, before[key as keyof typeof changes]]));
          replace(id, (calendar) => ({ ...calendar, ...undo }));
        }
        throw error;
      }
    },

    /**
     * `DELETE /api/calendars/:id`, which deletes its events too. A calendar
     * already gone (404) counts as deleted; the last one is refused with a
     * 409 `conflict` `ApiError`, and the list keeps it.
     */
    async remove(id: number): Promise<void> {
      try {
        await source.remove(id);
      } catch (error) {
        if (!isApiError(error, "not_found")) throw error;
      }
      resource.apply((calendars) => calendars.filter((each) => each.id !== id));
    },
  };
}

export type CalendarsStore = ReturnType<typeof createCalendarsStore>;

// --- The app's store ---------------------------------------------------------------

const calendarsStore = createCalendarsStore(calendarsApi);

resetWhenSignedOut(calendarsStore.resource.reset, authClient());

export interface CalendarsView {
  /** In the left column's order. Empty while loading. */
  readonly calendars: readonly Calendar[];
  readonly status: LoadStatus;
  /** Why the first load (or the last refresh) failed. */
  readonly error: ApiError | null;
  create(body: CalendarCreate): Promise<Calendar>;
  update(id: number, patch: CalendarPatch): Promise<Calendar>;
  remove(id: number): Promise<void>;
  /** Fetch again (Retry after `error`); never rejects. */
  refresh(): Promise<void>;
}

const actions = {
  create: calendarsStore.create,
  update: calendarsStore.update,
  remove: calendarsStore.remove,
  refresh: calendarsStore.resource.refresh,
};

/** The user's calendars, loaded on first use. Re-renders when any of them changes. */
export function useCalendars(): CalendarsView {
  const state = useStore(calendarsStore.resource.store);
  useEffect(() => calendarsStore.resource.ensureLoaded(), []);
  return useMemo(() => ({ calendars: state.value, status: state.status, error: state.error, ...actions }), [state]);
}

/** The calendars as they are now, outside a component. */
export function currentCalendars(): readonly Calendar[] {
  return calendarsStore.resource.store.getState().value;
}

/** A calendar's colour as a hex value (`#4285F4`), from the shared palette. */
export function calendarColor(calendar: { color: CalendarColor }): string {
  return CALENDAR_COLORS[calendar.color];
}
