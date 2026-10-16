import { z } from "zod";
import { isIanaZone } from "./time.js";

/**
 * A user's settings. v1 has one: the display time zone, which decides the
 * clock every time is shown in (corpus/wiki/glossary.md). There is no
 * Settings page; the account menu changes it.
 */

/** `GET /api/settings`, and what `PATCH` answers. A user who never changed it has `DEFAULT_TIME_ZONE`. */
export const settingsSchema = z.object({
  /** An IANA name such as `Europe/Bucharest` (`isIanaZone`). */
  timeZone: z.string(),
});
export type Settings = z.infer<typeof settingsSchema>;

export const timeZoneSchema = z
  .string({ error: "must be a time zone such as Europe/Bucharest" })
  .trim()
  .refine(isIanaZone, { message: "must be an IANA time zone such as Europe/Bucharest" });

/** `PATCH /api/settings`. A missing field is left as it is. */
export const settingsPatchSchema = z.strictObject({
  timeZone: timeZoneSchema.optional(),
});
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
