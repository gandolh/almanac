import { afterEach, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "../../testing/testApp.js";

let t: TestApp | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

describe("GET /api/health", () => {
  it("answers ok without a session", async () => {
    t = await startTestApp();
    const res = await t.app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
