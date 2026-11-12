import type { FastifyPluginAsync } from "fastify";

/** `GET /api/health`: the one route with no session (`PUBLIC_ROUTES`), for the container's health check. */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/health", async () => ({ status: "ok" }));
};
