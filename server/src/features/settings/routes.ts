import { settingsPatchSchema, settingsSchema } from "@almanac/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { currentUserId } from "../../plugins/auth/guard.js";
import type { SettingsStore } from "./store.js";

/** What the settings routes take from the app. */
export interface SettingsRoutesOptions {
  settings: SettingsStore;
}

/** The settings routes: the signed-in user's display time zone. Both answer the settings. */
export const settingsRoutes: FastifyPluginAsyncZod<SettingsRoutesOptions> = async (app, { settings }) => {
  app.get("/api/settings", { schema: { response: { 200: settingsSchema } } }, (request) =>
    settings.get(currentUserId(request)),
  );

  app.patch(
    "/api/settings",
    { schema: { body: settingsPatchSchema, response: { 200: settingsSchema } } },
    (request) => {
      const userId = currentUserId(request);
      return settings.set(userId, request.body);
    },
  );
};
