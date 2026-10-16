import { calendarCreateSchema, calendarPatchSchema, type CalendarList } from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { currentUserId } from "../auth/guard.js";
import { ApiError } from "../errors.js";
import { removeCalendar } from "../recurrence/scopes.js";

interface IdParams {
  Params: { id: string };
}

const noSuchCalendar = () => new ApiError("not_found", "There is no such calendar.");

/** A positive integer in the path, or a 404: `/api/calendars/abc` names no calendar, the same as another user's id. */
function calendarId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw noSuchCalendar();
  return id;
}

/**
 * The calendar routes (brief 03), each scoped to the signed-in user. A list
 * answers `{ calendars }`; one calendar answers the calendar itself. A user
 * always has a calendar: the list makes "Personal" for a new user, and the
 * last one cannot be deleted (409 `conflict`). Deleting one takes its events,
 * and keeps the repeating events in other calendars whole (`removeCalendar`).
 */
export const calendarRoutes: FastifyPluginAsync<FeatureContext> = async (app, { db, calendars, events }) => {
  app.get("/api/calendars", (request): CalendarList => {
    const userId = currentUserId(request);
    calendars.ensureDefault(userId);
    return { calendars: calendars.list(userId) };
  });

  app.post("/api/calendars", (request, reply) => {
    const userId = currentUserId(request);
    const input = calendarCreateSchema.parse(request.body);
    reply.code(201);
    return calendars.create(userId, input);
  });

  app.patch<IdParams>("/api/calendars/:id", (request) => {
    const userId = currentUserId(request);
    const id = calendarId(request.params.id);
    const calendar = calendars.update(userId, id, calendarPatchSchema.parse(request.body));
    if (!calendar) throw noSuchCalendar();
    return calendar;
  });

  app.delete<IdParams>("/api/calendars/:id", (request, reply) => {
    const userId = currentUserId(request);
    if (!removeCalendar({ db, calendars, events }, userId, calendarId(request.params.id))) throw noSuchCalendar();
    return reply.code(204).send();
  });
};
