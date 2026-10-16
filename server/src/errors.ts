import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

/**
 * Every error the API sends is `{ "error": { "code", "message" } }`. A route
 * throws `ApiError` (or calls `sendError` from a hook); a zod error from
 * parsing a body with a shared schema becomes `validation`; anything else goes
 * through `registerErrorHandling` below. A new code is one line in
 * `ERROR_STATUS`.
 */
export const ERROR_STATUS = {
  validation: 400,
  /** A route that needs a signed-in user was reached without a session (`currentUserId`, brief 02). */
  unauthorized: 401,
  /** A browser sent a change from a page on another origin (`auth/guard.ts`). */
  forbidden: 403,
  not_found: 404,
  internal: 500,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

/** Throw from a route or hook to answer `ERROR_STATUS[code]` with this message. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}

/** Answer with an error. Returns the reply, so a hook can `return sendError(...)`. */
export function sendError(reply: FastifyReply, code: ErrorCode, message: string): FastifyReply {
  return reply.code(ERROR_STATUS[code]).send(errorBody(code, message));
}

/** The first issue, prefixed with the field it is about: "title: must not be empty…". */
function describeIssue(error: z.core.$ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "The request is not valid.";
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

function statusOf(error: unknown): number | undefined {
  const status = (error as Partial<FastifyError> | null)?.statusCode;
  return typeof status === "number" ? status : undefined;
}

/**
 * The error handler and the 404 handler, at the root so every feature
 * inherits them. Register before any feature.
 *
 * - `ApiError` → its code.
 * - A zod error → 400 `validation`. `z.core.$ZodError`'s `instanceof` checks
 *   traits, so it also matches errors thrown by `@almanac/shared`'s zod.
 * - A 4xx Fastify raised itself (bad JSON, a body too large, an unsupported
 *   content type) keeps its status, with `not_found` for 404 and `validation`
 *   for the rest.
 * - Anything else → 500 `internal`, logged; the message carries no details.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ApiError) return sendError(reply, error.code, error.message);

    if (error instanceof z.core.$ZodError) return sendError(reply, "validation", describeIssue(error));

    const status = statusOf(error);
    if (status !== undefined && status >= 400 && status < 500) {
      const message = error instanceof Error ? error.message : "The request is not valid.";
      return reply.code(status).send(errorBody(status === 404 ? "not_found" : "validation", message));
    }

    request.log.error({ err: error }, "unhandled error");
    return sendError(reply, "internal", "Something went wrong on the server.");
  });

  app.setNotFoundHandler((_request, reply) => sendError(reply, "not_found", "There is no such route."));
}
