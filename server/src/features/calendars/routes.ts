import { calendarCreateSchema, calendarListSchema, calendarPatchSchema, calendarSchema } from "@almanac/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { Db } from "../../db/open.js";
import { ApiError } from "../../lib/api-error.js";
import { idParamsSchema } from "../../lib/id-params.js";
import { currentUserId } from "../../plugins/auth/guard.js";
import { removeCalendar, type EventStore } from "../events/index.js";
import type { CalendarStore } from "./store.js";

const noSuchCalendar = () => new ApiError("not_found", "There is no such calendar.");

/** A positive integer in the path, or a 404: `/api/calendars/abc` names no calendar, the same as another user's id. */
function calendarId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw noSuchCalendar();
  return id;
}

/** What the calendar routes take from the app. */
export interface CalendarRoutesOptions {
  db: Db;
  calendars: CalendarStore;
  events: EventStore;
}

/**
 * The calendar routes, each scoped to the signed-in user. A list
 * answers `{ calendars }`; one calendar answers the calendar itself. A user
 * always has a calendar: the list makes "Personal" for a new user, and the
 * last one cannot be deleted (409 `conflict`). Deleting one takes its events,
 * and keeps the repeating events in other calendars whole (`removeCalendar`).
 */
export const calendarRoutes: FastifyPluginAsyncZod<CalendarRoutesOptions> = async (app, { db, calendars, events }) => {
  app.get("/api/calendars", { schema: { response: { 200: calendarListSchema } } }, (request) => {
    const userId = currentUserId(request);
    calendars.ensureDefault(userId);
    return { calendars: calendars.list(userId) };
  });

  app.post(
    "/api/calendars",
    { schema: { body: calendarCreateSchema, response: { 201: calendarSchema } } },
    (request, reply) => {
      const userId = currentUserId(request);
      reply.code(201);
      return calendars.create(userId, request.body);
    },
  );

  app.patch(
    "/api/calendars/:id",
    { schema: { params: idParamsSchema, body: calendarPatchSchema, response: { 200: calendarSchema } } },
    (request) => {
      const userId = currentUserId(request);
      const id = calendarId(request.params.id);
      const calendar = calendars.update(userId, id, request.body);
      if (!calendar) throw noSuchCalendar();
      return calendar;
    },
  );

  app.delete(
    "/api/calendars/:id",
    { schema: { params: idParamsSchema, response: { 204: z.null() } } },
    (request, reply) => {
      const userId = currentUserId(request);
      if (!removeCalendar({ db, calendars, events }, userId, calendarId(request.params.id))) throw noSuchCalendar();
      reply.code(204);
      return null;
    },
  );
};
