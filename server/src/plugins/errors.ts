import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "@fastify/type-provider-zod";
import type { FastifyError, FastifyPluginAsync, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { ERROR_STATUS, ApiError, errorBody, type ErrorCode } from "../lib/api-error.js";

/** Answer with an error. Returns the reply, so a hook can `return sendError(...)`. */
export function sendError(reply: FastifyReply, code: ErrorCode, message: string): FastifyReply {
  return reply.code(ERROR_STATUS[code]).send(errorBody(code, message));
}

/** The first zod issue, prefixed with the field it is about: "title: must not be empty…". */
function describeIssue(path: string, message: string | undefined): string {
  const text = message ?? "The request is not valid.";
  return path ? `${path}: ${text}` : text;
}

function statusOf(error: unknown): number | undefined {
  const status = (error as Partial<FastifyError> | null)?.statusCode;
  return typeof status === "number" ? status : undefined;
}

/**
 * The error handler and the 404 handler, wrapped in `fastify-plugin` and
 * registered first, so every feature inherits them.
 *
 * - `ApiError` → its code.
 * - A request that fails its route schema → 400 `validation`, with the first
 *   issue's field and message.
 * - A zod error → 400 `validation`: a parse left in a service, such as a
 *   merged patch. `instanceof` checks traits, so it also matches errors
 *   thrown by `@almanac/shared`'s zod.
 * - A reply that fails its response schema → 500 `internal`, logged with the
 *   method and URL; the client never sees it.
 * - A 4xx Fastify raised itself (bad JSON, a body too large, an unsupported
 *   content type) keeps its status, with `not_found` for 404 and
 *   `validation` for the rest.
 * - Anything else → 500 `internal`, logged; the message carries no details.
 */
const errorHandling: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ApiError) return sendError(reply, error.code, error.message);

    if (hasZodFastifySchemaValidationErrors(error)) {
      const issue = error.validation[0];
      // `/changes/title` is `changes.title`; a root issue (`/`) has no field.
      const path = (issue?.instancePath ?? "").split("/").filter(Boolean).join(".");
      return sendError(reply, "validation", describeIssue(path, issue?.message));
    }

    if (error instanceof z.core.$ZodError) {
      const issue = error.issues[0];
      return sendError(reply, "validation", describeIssue(issue?.path.map(String).join(".") ?? "", issue?.message));
    }

    const status = statusOf(error);
    if (status !== undefined && status >= 400 && status < 500) {
      const message = error instanceof Error ? error.message : "The request is not valid.";
      return reply.code(status).send(errorBody(status === 404 ? "not_found" : "validation", message));
    }

    if (isResponseSerializationError(error)) {
      // A handler sent what its response schema doesn't allow: a bug to fix, never the client's fault.
      request.log.error({ err: error }, `${error.method} ${error.url}: the reply doesn't match its schema`);
    } else {
      request.log.error({ err: error }, "unhandled error");
    }
    return sendError(reply, "internal", "Something went wrong on the server.");
  });

  app.setNotFoundHandler((_request, reply) => sendError(reply, "not_found", "There is no such route."));
};

export const errors = fp(errorHandling, { name: "errors" });
