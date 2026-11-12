import { settingsPatchSchema, type Settings } from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import { currentUserId } from "../../plugins/auth/guard.js";
import type { SettingsStore } from "./store.js";

/** What the settings routes take from the app. */
export interface SettingsRoutesOptions {
  settings: SettingsStore;
}

/** The settings routes: the signed-in user's display time zone. Both answer the settings. */
export const settingsRoutes: FastifyPluginAsync<SettingsRoutesOptions> = async (app, { settings }) => {
  app.get("/api/settings", (request): Settings => settings.get(currentUserId(request)));

  app.patch("/api/settings", (request): Settings => {
    const userId = currentUserId(request);
    return settings.set(userId, settingsPatchSchema.parse(request.body));
  });
};
