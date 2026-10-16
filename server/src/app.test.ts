import { afterEach, describe, expect, it } from "vitest";
import { startSignedInApp, startTestApp, type TestApp } from "./testing/testApp.js";

let t: TestApp | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

describe("the app", () => {
  it("answers the health check", async () => {
    t = await startTestApp();
    const res = await t.app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("answers an unknown route in the error shape, once signed in (brief 02's guard answers 401 before that)", async () => {
    const app = await startSignedInApp();
    t = app;
    const res = await app.inject({ method: "GET", url: "/api/nothing" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "not_found", message: "There is no such route." } });
  });

  it("refuses to start on a bad environment", async () => {
    await expect(startTestApp({ PORT: "70000" })).rejects.toThrow("PORT");
  });
});
