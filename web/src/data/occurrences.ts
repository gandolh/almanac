import {
  eventDeleteQuerySchema,
  eventInputSchema,
  eventPatchSchema,
  occurrenceListSchema,
  occurrenceSchema,
  type EditScope,
  type Occurrence,
} from "@almanac/shared";
import { ApiError, apiRequest, type RequestOptions } from "../api";

/**
 * Occurrences and the event writes (briefs 03 and 04's routes), for every
 * view: day, week and month (brief 06), the year view (08), the event form
 * (07) and search (10).
 *
 * - Reads are not cached here: a view asks for its own range and keeps what
 *   it got.
 * - Every write is checked with the shared schema before it is sent (a
 *   failure is the same 400 `validation` `ApiError` the server would answer,
 *   "end: must be after the start"), and every answer is checked on the way
 *   back.
 * - After every write the server accepted, `onOccurrencesChanged` listeners
 *   hear about it, so every open view fetches its range again.
 */

/** What `POST /api/events` takes, before the schema's defaults and trimming (`z.input` of `eventInputSchema`). */
export type EventInputBody = (typeof eventInputSchema)["_zod"]["input"];

/** What `PATCH /api/events/:id` takes (`z.input` of `eventPatchSchema`): `changes` are what this occurrence becomes. */
export type EventPatchBody = (typeof eventPatchSchema)["_zod"]["input"];

/** Which occurrences a delete takes, and which one this is: `{ scope, occurrence: originalStart }` for a series. */
export interface DeleteOptions {
  scope?: EditScope;
  occurrence?: string;
}

// --- Change notification ------------------------------------------------------------------

const listeners = new Set<() => void>();

/** Hear about every write the server accepted (from this tab). Returns the unsubscribe function. */
export function onOccurrencesChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Tell every view its occurrences may have changed. The writes below call
 * it; call it yourself after a change that touches events some other way
 * (deleting a calendar deletes its events).
 */
export function notifyOccurrencesChanged(): void {
  for (const listener of [...listeners]) listener();
}

// --- Checking what is sent -------------------------------------------------------------------

interface RequestSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: readonly Issue[] } };
}

interface Issue {
  path: readonly PropertyKey[];
  message: string;
}

/** The parsed body, or the 400 `validation` error the server would answer, worded as it words it. */
function checked<T>(schema: RequestSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const path = issue?.path.map(String).join(".") ?? "";
  const message = issue ? (path ? `${path}: ${issue.message}` : issue.message) : "The request is not valid.";
  throw new ApiError(400, "validation", message);
}

// --- Reads -----------------------------------------------------------------------------------

/**
 * `GET /api/occurrences?from&to`: the occurrences overlapping `[from, to)`,
 * ISO instants at most 400 days apart (`instantRange` makes them from a span
 * of days), in start order.
 */
export async function fetchOccurrences(from: string, to: string, options: Pick<RequestOptions, "signal"> = {}): Promise<Occurrence[]> {
  const query = new URLSearchParams({ from, to });
  const answer = await apiRequest(`/api/occurrences?${query.toString()}`, { schema: occurrenceListSchema, signal: options.signal });
  return answer.occurrences;
}

// --- Writes ----------------------------------------------------------------------------------

/** `POST /api/events`; resolves to the new event's first occurrence. */
export async function createEvent(input: EventInputBody): Promise<Occurrence> {
  const body = checked(eventInputSchema, input);
  const occurrence = await apiRequest("/api/events", { method: "POST", body, schema: occurrenceSchema });
  notifyOccurrencesChanged();
  return occurrence;
}

/**
 * `PATCH /api/events/:id`, where `id` is the occurrence's `eventId`. For an
 * occurrence of a series (or an exception) send `scope` and `occurrence:
 * originalStart`; the server refuses a series write without a scope.
 */
export async function updateEvent(id: number, patch: EventPatchBody): Promise<Occurrence> {
  const body = checked(eventPatchSchema, patch);
  const occurrence = await apiRequest(`/api/events/${id}`, { method: "PATCH", body, schema: occurrenceSchema });
  notifyOccurrencesChanged();
  return occurrence;
}

/** `DELETE /api/events/:id?scope&occurrence`, where `id` is the occurrence's `eventId`. */
export async function deleteEvent(id: number, options: DeleteOptions = {}): Promise<void> {
  const query = checked(eventDeleteQuerySchema, options);
  const params = new URLSearchParams();
  if (query.scope !== undefined) params.set("scope", query.scope);
  if (query.occurrence !== undefined) params.set("occurrence", query.occurrence);
  const search = params.toString();
  await apiRequest(`/api/events/${id}${search ? `?${search}` : ""}`, { method: "DELETE" });
  notifyOccurrencesChanged();
}
