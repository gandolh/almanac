/**
 * Every error the API sends is `{ "error": { "code", "message" } }`. A route
 * or a store throws `ApiError`; the error plugin (`plugins/errors.ts`)
 * answers it. A new code is one line in `ERROR_STATUS`. No Fastify import
 * here: the stores throw these.
 */
export const ERROR_STATUS = {
  validation: 400,
  /** A route that needs a signed-in user was reached without a session (`currentUserId`). */
  unauthorized: 401,
  /** A browser sent a change from a page on another origin (`plugins/auth/guard.ts`). */
  forbidden: 403,
  not_found: 404,
  /** The change would break a rule about what is already stored: deleting the user's last calendar. */
  conflict: 409,
  /** Too many requests from one address in a while: the calendar feed's limit, or the 404 handler's. */
  rate_limited: 429,
  internal: 500,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

/** Throw from a route or hook to answer `ERROR_STATUS[code]` with this message. */
export class ApiError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}
