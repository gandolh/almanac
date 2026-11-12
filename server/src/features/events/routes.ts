import { eventDeleteQuerySchema, eventInputSchema, eventPatchSchema, occurrenceSchema } from "@almanac/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { Db } from "../../db/open.js";
import { currentUserId } from "../../plugins/auth/guard.js";
import { ApiError } from "../../lib/api-error.js";
import { idParamsSchema } from "../../lib/id-params.js";
import type { SettingsStore } from "../settings/index.js";
import { createEvent, deleteEvent, updateEvent } from "./service.js";
import type { EventStore } from "./store.js";

/** A positive integer in the path, or a 404: `/api/events/abc` names no event, the same as another user's id. */
function eventId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw new ApiError("not_found", "There is no such event.");
  return id;
}

/** What the event routes take from the app. */
export interface EventRoutesOptions {
  db: Db;
  events: EventStore;
  /** The display time zone: new rows take their `tzid` from it. */
  settings: SettingsStore;
}

/**
 * The event writes, each scoped to the signed-in user and run as one
 * transaction by `service.ts`, which says what each edit scope
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
export const eventRoutes: FastifyPluginAsyncZod<EventRoutesOptions> = async (app, { db, events, settings }) => {
  app.post(
    "/api/events",
    { schema: { body: eventInputSchema, response: { 201: occurrenceSchema } } },
    (request, reply) => {
      const userId = currentUserId(request);
      const occurrence = createEvent({ db, events }, userId, request.body, settings.get(userId).timeZone);
      reply.code(201);
      return occurrence;
    },
  );

  app.patch(
    "/api/events/:id",
    { schema: { params: idParamsSchema, body: eventPatchSchema, response: { 200: occurrenceSchema } } },
    (request) => {
      const userId = currentUserId(request);
      const id = eventId(request.params.id);
      return updateEvent({ db, events }, userId, id, request.body, settings.get(userId).timeZone);
    },
  );

  app.delete(
    "/api/events/:id",
    { schema: { params: idParamsSchema, querystring: eventDeleteQuerySchema, response: { 204: z.null() } } },
    (request, reply) => {
      const userId = currentUserId(request);
      const id = eventId(request.params.id);
      deleteEvent({ db, events }, userId, id, request.query);
      reply.code(204);
      return null;
    },
  );
};
