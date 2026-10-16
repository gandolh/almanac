import { API_BASE } from "./base";

export { API_BASE } from "./base";

/**
 * The API client: `fetch` under `/almanac-api`, JSON in and out, the shared
 * schemas checking every answer so the app can't drift from the server.
 *
 * Every failure is one `ApiError` with the server's `code` and `message` and
 * the HTTP `status`. A few codes are the client's own: `signed_out` (a 401,
 * after which `onSignedOut` listeners hear about it), `network` (no answer at
 * all, status 0) and `bad_response` (an answer that isn't Almanac's). An
 * aborted call rethrows the abort reason unchanged.
 */

/** The server's codes (server/src/errors.ts), then the client's own. */
export type ApiErrorCode =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "internal"
  | "signed_out"
  | "network"
  | "bad_response"
  // A code a newer server sends that this list doesn't name yet.
  | (string & {});

export class ApiError extends Error {
  /** The HTTP status; 0 when the request never got an answer. */
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

// --- Signed out -----------------------------------------------------------------

const signedOutListeners = new Set<() => void>();

/**
 * Hear about every 401 from any call: the session is over (signed out, the
 * password changed elsewhere, a Ward session ended). The auth gate
 * (`auth/session.ts`) listens and shows the login page. Returns the
 * unsubscribe function.
 */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
}

function signedOut(): void {
  for (const listener of signedOutListeners) listener();
}

// --- Requests -------------------------------------------------------------------

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** The part of a zod schema the client uses, so the shared schemas fit without importing zod here. */
export interface ResponseSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

export interface RequestOptions {
  method?: HttpMethod;
  /** Sent as JSON. */
  body?: unknown;
  /** Aborts the request, e.g. `AbortSignal.timeout(10_000)`. */
  signal?: AbortSignal;
  /**
   * A 401 is this call's own answer (a login form's wrong password), not the
   * session ending: it becomes an ordinary `ApiError` and nobody is told.
   */
  noSignOut?: boolean;
}

/** The browser path of an API route: `/api/calendars` → `/almanac-api/api/calendars`. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/**
 * One call to the API. With a `schema`, resolves to the parsed answer;
 * without one, to nothing (a 204, or an answer the caller doesn't read).
 */
export function apiRequest<T>(path: string, options: RequestOptions & { schema: ResponseSchema<T> }): Promise<T>;
export function apiRequest(path: string, options?: RequestOptions): Promise<void>;
export async function apiRequest<T>(
  path: string,
  options: RequestOptions & { schema?: ResponseSchema<T> } = {},
): Promise<T | void> {
  const { method = "GET", body, signal, schema, noSignOut = false } = options;
  const headers: Record<string, string> = { accept: "application/json" };
  const init: RequestInit = { method, headers, credentials: "same-origin", signal };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await send(apiUrl(path), init, signal);

  if (response.status === 401 && !noSignOut) throw sessionEnded();
  if (!response.ok) throw await failure(response);
  if (!schema) return;

  const data: unknown = await response.json().catch(() => undefined);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(response.status, "bad_response", "Almanac sent an answer this app doesn't understand. Reload the page.");
  }
  return parsed.data;
}

/** A 401: tell the listeners, and the caller gets this. */
function sessionEnded(): ApiError {
  signedOut();
  return new ApiError(401, "signed_out", "You're signed out. Sign in to carry on.");
}

async function send(url: string, init: RequestInit, signal: AbortSignal | undefined): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    throw new ApiError(0, "network", "Almanac can't be reached. Check your connection.", { cause: error });
  }
}

/** The server's `{ error: { code, message } }`, or a stand-in when a proxy answered instead. */
async function failure(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  if (isErrorBody(body)) return new ApiError(response.status, body.error.code, body.error.message);
  // Not Almanac's error shape: a proxy's page in front of a stopped API.
  return new ApiError(response.status, "bad_response", "Almanac isn't answering right now. Try again in a moment.");
}

function isErrorBody(body: unknown): body is { error: { code: string; message: string } } {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const error = (body as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}
