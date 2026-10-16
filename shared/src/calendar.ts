import { z } from "zod";

/**
 * A calendar is a named, coloured group of one user's events that is shown or
 * hidden as a whole (corpus/wiki/glossary.md). These schemas are the API's
 * contract; the server's store maps them to the `calendars` table.
 */

/**
 * The palette a calendar's colour is picked from, by key, in the order the
 * picker shows it. The values are Google Calendar's own calm shades. The
 * store keeps the key, so a shade can change here without touching a row.
 */
export const CALENDAR_COLORS = {
  blue: "#4285F4",
  teal: "#009688",
  green: "#33B679",
  olive: "#7CB342",
  yellow: "#F6BF26",
  orange: "#F4511E",
  red: "#D50000",
  pink: "#E67C73",
  purple: "#8E24AA",
  graphite: "#616161",
} as const;

export type CalendarColor = keyof typeof CALENDAR_COLORS;

export const CALENDAR_COLOR_KEYS = Object.keys(CALENDAR_COLORS) as [CalendarColor, ...CalendarColor[]];

export const calendarColorSchema = z.enum(CALENDAR_COLOR_KEYS, {
  message: `must be one of ${CALENDAR_COLOR_KEYS.join(", ")}`,
});

/** What a new user's calendar is called, and the colour it gets. */
export const DEFAULT_CALENDAR_NAME = "Personal";
export const DEFAULT_CALENDAR_COLOR: CalendarColor = "blue";

/** The first palette colour none of `used` has, or the first colour when every one is taken. */
export function nextCalendarColor(used: readonly string[]): CalendarColor {
  return CALENDAR_COLOR_KEYS.find((key) => !used.includes(key)) ?? DEFAULT_CALENDAR_COLOR;
}

export const CALENDAR_NAME_MAX = 60;

/** A calendar as the API returns it. */
export const calendarSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  color: calendarColorSchema,
  /** Whether its events show in the views (the checkbox in the left column). */
  visible: z.boolean(),
  /** Its place in the left column: lists are ordered by it. A new calendar goes last. */
  position: z.number().int(),
  /** UTC ISO timestamps, set by the server. */
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Calendar = z.infer<typeof calendarSchema>;

/** `GET /api/calendars`: the user's calendars by position. Never empty: the route makes "Personal" first. */
export const calendarListSchema = z.object({ calendars: z.array(calendarSchema) });
export type CalendarList = z.infer<typeof calendarListSchema>;

const calendarNameSchema = z
  .string({ error: "a calendar needs a name" })
  .trim()
  .min(1, { message: "a calendar needs a name" })
  .max(CALENDAR_NAME_MAX, { message: `must be at most ${CALENDAR_NAME_MAX} characters` });

/**
 * `POST /api/calendars`. Left out, `color` is the first palette colour the
 * user's calendars don't have yet (`nextCalendarColor`) and `visible` is true.
 */
export const calendarCreateSchema = z.strictObject({
  name: calendarNameSchema,
  color: calendarColorSchema.optional(),
  visible: z.boolean().optional(),
});
export type CalendarCreate = z.infer<typeof calendarCreateSchema>;

/** `PATCH /api/calendars/:id`. Every field is optional; a missing one is left as it is. */
export const calendarPatchSchema = z.strictObject({
  name: calendarNameSchema.optional(),
  color: calendarColorSchema.optional(),
  visible: z.boolean().optional(),
});
export type CalendarPatch = z.infer<typeof calendarPatchSchema>;
