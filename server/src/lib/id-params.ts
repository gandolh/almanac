import { z } from "zod";

/**
 * `:id` in a path, as the string it arrives as. It stays a plain string on
 * purpose: each handler turns it into a number with its own `calendarId()` or
 * `eventId()`, and answers a non-numeric id with 404 `not_found`. A regex
 * here would answer 400.
 */
export const idParamsSchema = z.object({ id: z.string() });
