import {
  eventDeleteQuerySchema,
  eventInputSchema,
  eventPatchSchema,
  type Occurrence,
  type Repeat,
} from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { currentUserId } from "../auth/guard.js";
import { ApiError } from "../errors.js";
import type { EventRecord } from "../store/events.js";
import { rowOccurrence } from "./occurrences.js";

interface IdParams {
  Params: { id: string };
}

const noSuchEvent = () => new ApiError("not_found", "There is no such event.");

/** A positive integer in the path, or a 404: `/api/events/abc` names no event, the same as another user's id. */
function eventId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw noSuchEvent();
  return id;
}

/** Repeating is brief 04's: until then the routes store one-off events only. */
function refuseRepeat(repeat: Repeat | null | undefined): void {
  if (repeat !== null && repeat !== undefined) {
    throw new ApiError("validation", "repeat: repeating events are not supported yet, send null");
  }
}

/** The fields of a stored event as an input, for merging a patch's changes onto. */
function asInput(event: EventRecord) {
  const { calendarId, title, location, notes, allDay, start, end } = event;
  return { calendarId, title, location, notes, allDay, start, end, repeat: null };
}

/**
 * The event writes (brief 03), each scoped to the signed-in user. A write
 * answers the row it wrote as an occurrence (`rowOccurrence`). The calendar
 * must be the user's (404 otherwise, as for an event). New rows take `tzid`
 * from the user's display time zone.
 *
 * `scope` and `occurrence` are checked for shape and otherwise ignored: every
 * row is a one-off until brief 04, which makes them choose what a write to a
 * series does.
 */
export const eventRoutes: FastifyPluginAsync<FeatureContext> = async (app, { events, settings }) => {
  app.post("/api/events", (request, reply): Occurrence => {
    const userId = currentUserId(request);
    const input = eventInputSchema.parse(request.body);
    refuseRepeat(input.repeat);
    const { calendarId, title, location, notes, allDay, start, end } = input;
    const event = events.create(userId, {
      calendarId,
      title,
      location,
      notes,
      allDay,
      start,
      end,
      tzid: settings.get(userId).timeZone,
    });
    reply.code(201);
    return rowOccurrence(event);
  });

  app.patch<IdParams>("/api/events/:id", (request): Occurrence => {
    const userId = currentUserId(request);
    const id = eventId(request.params.id);
    const { changes } = eventPatchSchema.parse(request.body);
    refuseRepeat(changes.repeat);
    const current = events.get(userId, id);
    if (!current) throw noSuchEvent();
    // The changes are checked as a whole once merged: a new end alone must still follow the stored start.
    const { calendarId, title, location, notes, allDay, start, end } = eventInputSchema.parse({
      ...asInput(current),
      ...changes,
    });
    const event = events.update(userId, id, { calendarId, title, location, notes, allDay, start, end });
    if (!event) throw noSuchEvent();
    return rowOccurrence(event);
  });

  app.delete<IdParams>("/api/events/:id", (request, reply) => {
    const userId = currentUserId(request);
    const id = eventId(request.params.id);
    eventDeleteQuerySchema.parse(request.query);
    if (!events.remove(userId, id)) throw noSuchEvent();
    return reply.code(204).send();
  });
};
