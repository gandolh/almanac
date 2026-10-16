import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { ApiError } from "../errors.js";
import { crossOriginWrite, currentUserId } from "./guard.js";

const ORIGIN = "http://localhost:5177";

/** Just the parts of a request the two functions read. */
function request(parts: { method?: string; headers?: Record<string, string>; auth?: unknown }): FastifyRequest {
  return { method: "GET", headers: {}, auth: null, ...parts } as unknown as FastifyRequest;
}

describe("currentUserId", () => {
  it("is the signed-in user's id", () => {
    const auth = { user: { id: "u-1", username: "ana", role: "user", hasPassword: true }, session: {} };
    expect(currentUserId(request({ auth }))).toBe("u-1");
  });

  it("is a 401 in Almanac's error shape on a request with no session", () => {
    let thrown: unknown;
    try {
      currentUserId(request({}));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown).toMatchObject({ code: "unauthorized" });
  });
});

describe("crossOriginWrite", () => {
  it("lets every read through, whatever the headers", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(crossOriginWrite(request({ method, headers: { origin: "https://example.net", "sec-fetch-site": "cross-site" } }), ORIGIN)).toBe(false);
    }
  });

  it("refuses a write from another origin, by Origin or by Sec-Fetch-Site", () => {
    expect(crossOriginWrite(request({ method: "POST", headers: { origin: "https://example.net" } }), ORIGIN)).toBe(true);
    expect(crossOriginWrite(request({ method: "POST", headers: { origin: "null" } }), ORIGIN)).toBe(true);
    expect(crossOriginWrite(request({ method: "DELETE", headers: { "sec-fetch-site": "same-site" } }), ORIGIN)).toBe(true);
  });

  it("lets a write from the app's own pages through, and one with neither header", () => {
    expect(crossOriginWrite(request({ method: "POST", headers: { origin: ORIGIN, "sec-fetch-site": "same-origin" } }), ORIGIN)).toBe(false);
    expect(crossOriginWrite(request({ method: "PATCH" }), ORIGIN)).toBe(false);
  });
});
