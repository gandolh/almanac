import { eventDeleteQuerySchema, eventInputSchema, eventPatchSchema, type Occurrence } from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { currentUserId } from "../auth/guard.js";
import { ApiError } from "../errors.js";
import { createEvent, deleteEvent, updateEvent } from "../recurrence/scopes.js";

interface IdParams {
  Params: { id: string };
}

/** A positive integer in the path, or a 404: `/api/events/abc` names no event, the same as another user's id. */
function eventId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw new ApiError("not_found", "There is no such event.");
  return id;
}

/**
 * The event writes, each scoped to the signed-in user and run as one
 * transaction by `recurrence/scopes.ts`, which says what each edit scope
 * does. The calendar must be the user's (404 otherwise, as for an event).
 * New rows take `tzid` from the user's display time zone, and so does a
 * one-off that becomes a series; a series keeps its own.
 *
 * `:id` is an occurrence's `eventId`: a one-off event, a series (with
 * `occurrence`, the occurrence's key, for "this" and "following"), or an
 * exception (its own row; it names its occurrence). For a series or an
 * exception `scope` is required (400 without); a one-off ignores both.
 *
 * What a write answers, always one occurrence:
 *
 * - a one-off event, or a series edit that leaves a one-off (`repeat: null`):
 *   the row, `e<id>`;
 * - a new series, "all", "following", or a one-off given a repeat: the first
 *   occurrence of the series the edit leaves (for "following", the new
 *   series), `s<seriesId>:<key>`, or its exception `e<id>` if it has one;
 * - "this": the exception, `e<id>`, with `seriesId` and `originalStart`.
 */
export const eventRoutes: FastifyPluginAsync<FeatureContext> = async (app, { db, events, settings }) => {
  app.post("/api/events", (request, reply): Occurrence => {
    const userId = currentUserId(request);
    const input = eventInputSchema.parse(request.body);
    const occurrence = createEvent({ db, events }, userId, input, settings.get(userId).timeZone);
    reply.code(201);
    return occurrence;
  });

  app.patch<IdParams>("/api/events/:id", (request): Occurrence => {
    const userId = currentUserId(request);
    const id = eventId(request.params.id);
    const patch = eventPatchSchema.parse(request.body);
    return updateEvent({ db, events }, userId, id, patch, settings.get(userId).timeZone);
  });

  app.delete<IdParams>("/api/events/:id", (request, reply) => {
    const userId = currentUserId(request);
    const id = eventId(request.params.id);
    const query = eventDeleteQuerySchema.parse(request.query);
    deleteEvent({ db, events }, userId, id, query);
    return reply.code(204).send();
  });
};
