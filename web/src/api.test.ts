import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, apiUrl, isApiError, onSignedOut, type ResponseSchema } from "./api";

/** A schema of the shape the shared zod schemas have, for a `{ name }` answer. */
const named: ResponseSchema<{ name: string }> = {
  safeParse(data) {
    const name = (data as { name?: unknown } | null)?.name;
    return typeof name === "string" ? { success: true, data: { name } } : { success: false };
  },
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function apiError(status: number, code: string, message = code): Response {
  return json(status, { error: { code, message } });
}

let calls: { url: string; init: RequestInit }[];
let signedOutCount: number;
let stopListening: () => void;

function serve(handler: (url: string, init: RequestInit) => Response | Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

beforeEach(() => {
  calls = [];
  signedOutCount = 0;
  stopListening = onSignedOut(() => {
    signedOutCount += 1;
  });
});

afterEach(() => {
  stopListening();
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("asks under /almanac-api with the session cookie, and parses the answer", async () => {
    serve(() => json(200, { name: "Work" }));
    expect(await apiRequest("/api/calendars/1", { schema: named })).toEqual({ name: "Work" });
    expect(calls[0]?.url).toBe("/almanac-api/api/calendars/1");
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.init.credentials).toBe("same-origin");
    expect(calls[0]?.init.body).toBeUndefined();
    expect(apiUrl("/api/health")).toBe("/almanac-api/api/health");
  });

  it("sends a body as JSON", async () => {
    serve(() => json(201, { name: "Gym" }));
    await apiRequest("/api/calendars", { method: "POST", body: { name: "Gym" }, schema: named });
    const call = calls[0];
    expect(call?.init.method).toBe("POST");
    expect(call?.init.body).toBe('{"name":"Gym"}');
    expect((call?.init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("resolves to nothing for a 204, and for an answer it wasn't asked to read", async () => {
    serve(() => new Response(null, { status: 204 }));
    await expect(apiRequest("/api/calendars/1", { method: "DELETE" })).resolves.toBeUndefined();
    serve(() => json(200, { status: "ok" }));
    await expect(apiRequest("/api/health")).resolves.toBeUndefined();
  });

  it("refuses an answer that doesn't fit the schema", async () => {
    serve(() => json(200, { name: 7 }));
    const error = await failure(apiRequest("/api/calendars/1", { schema: named }));
    expect(error.code).toBe("bad_response");
    expect(error.status).toBe(200);
  });
});

describe("errors", () => {
  it("carry the server's code, message and status", async () => {
    serve(() => apiError(400, "validation", "name: must not be empty"));
    const error = await failure(apiRequest("/api/calendars", { method: "POST", body: { name: "" } }));
    expect(error).toMatchObject({ status: 400, code: "validation", message: "name: must not be empty" });
    expect(isApiError(error, "validation")).toBe(true);
    expect(isApiError(error, "not_found")).toBe(false);
    expect(signedOutCount).toBe(0);
  });

  it("stand in for a proxy's page in front of a stopped API", async () => {
    serve(() => new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
    const error = await failure(apiRequest("/api/calendars"));
    expect(error.status).toBe(502);
    expect(error.code).toBe("bad_response");
    expect(error.message).toMatch(/isn't answering/);
  });

  it("say when there was no answer at all", async () => {
    serve(() => Promise.reject(new TypeError("Failed to fetch")));
    const error = await failure(apiRequest("/api/calendars"));
    expect(error.status).toBe(0);
    expect(error.code).toBe("network");
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it("let an abort through as itself", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Stopped", "AbortError");
    serve(() => {
      controller.abort(reason);
      return Promise.reject(reason);
    });
    await expect(apiRequest("/api/calendars", { signal: controller.signal })).rejects.toBe(reason);
  });
});

describe("a 401", () => {
  it("raises the signed-out signal, whatever the body, and fails the call", async () => {
    serve(() => json(401, { error: "unauthorized" }));
    const error = await failure(apiRequest("/api/calendars"));
    expect(error).toMatchObject({ status: 401, code: "signed_out" });
    expect(signedOutCount).toBe(1);
    expect(calls).toHaveLength(1); // no retry
  });

  it("tells every listener until it unsubscribes", async () => {
    serve(() => new Response(null, { status: 401 }));
    let other = 0;
    const stop = onSignedOut(() => {
      other += 1;
    });
    await failure(apiRequest("/api/calendars"));
    stop();
    await failure(apiRequest("/api/calendars"));
    expect(other).toBe(1);
    expect(signedOutCount).toBe(2);
  });

  it("is the call's own answer with noSignOut (a login form's wrong password)", async () => {
    serve(() => apiError(401, "unauthorized", "Wrong username or password"));
    const error = await failure(apiRequest("/auth/login", { method: "POST", body: { username: "u" }, noSignOut: true }));
    expect(error).toMatchObject({ status: 401, code: "unauthorized", message: "Wrong username or password" });
    expect(signedOutCount).toBe(0);
  });
});
