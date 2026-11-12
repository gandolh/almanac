import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * A request with `Content-Type: application/json` and no body (a client that
 * sets the header on every call, DELETE included) is a body of `undefined`,
 * not a 400. Anything else goes to Fastify's own parser, which keeps its
 * prototype-poisoning checks and its 400 for bad JSON.
 */
const jsonBody: FastifyPluginAsync = async (app) => {
  const parseJson = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    if (body === "") {
      done(null, undefined);
      return;
    }
    void parseJson(request, body as string, done);
  });
};

export const jsonBodyParser = fp(jsonBody, { name: "json-body" });
