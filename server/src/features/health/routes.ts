import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";

// Only the server uses this schema, so it lives with the feature, not in shared/.
const healthSchema = z.object({ status: z.literal("ok") });

/** `GET /api/health`: the one route with no session (`PUBLIC_ROUTES`), for the container's health check. */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/api/health", { schema: { response: { 200: healthSchema } } }, async () => ({ status: "ok" as const }));
};
