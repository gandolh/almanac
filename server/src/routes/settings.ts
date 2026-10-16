import { settingsPatchSchema, type Settings } from "@almanac/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { currentUserId } from "../auth/guard.js";

/** The settings routes (brief 03): the signed-in user's display time zone. Both answer the settings. */
export const settingsRoutes: FastifyPluginAsync<FeatureContext> = async (app, { settings }) => {
  app.get("/api/settings", (request): Settings => settings.get(currentUserId(request)));

  app.patch("/api/settings", (request): Settings => {
    const userId = currentUserId(request);
    return settings.set(userId, settingsPatchSchema.parse(request.body));
  });
};
