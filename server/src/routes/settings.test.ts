import { settingsSchema } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";

let t: SignedInTestApp;

beforeEach(async () => {
  t = await startSignedInApp();
});

afterEach(async () => {
  await t.close();
});

describe("/api/settings", () => {
  it("answers 401 without a session", async () => {
    expect((await t.app.inject({ method: "GET", url: "/api/settings" })).statusCode).toBe(401);
    expect((await t.app.inject({ method: "PATCH", url: "/api/settings", payload: {} })).statusCode).toBe(401);
  });

  it("starts at Europe/Bucharest", async () => {
    const res = await t.inject({ method: "GET", url: "/api/settings" });
    expect(res.statusCode).toBe(200);
    expect(settingsSchema.parse(res.json())).toEqual({ timeZone: "Europe/Bucharest" });
  });

  it("changes the display time zone for this user only", async () => {
    const res = await t.inject({ method: "PATCH", url: "/api/settings", payload: { timeZone: "America/New_York" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ timeZone: "America/New_York" });
    expect((await t.inject({ method: "GET", url: "/api/settings" })).json()).toEqual({ timeZone: "America/New_York" });

    const other = await t.signInAs("other");
    expect((await other.inject({ method: "GET", url: "/api/settings" })).json()).toEqual({ timeZone: "Europe/Bucharest" });
  });

  it("refuses a zone that is not an IANA name, and unknown fields", async () => {
    for (const payload of [{ timeZone: "+02:00" }, { timeZone: "Atlantis/Capital" }, { timeZone: 3 }, { theme: "dark" }]) {
      const res = await t.inject({ method: "PATCH", url: "/api/settings", payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect((res.json() as { error: { code: string; message: string } }).error).toMatchObject({ code: "validation" });
    }
    expect((await t.inject({ method: "GET", url: "/api/settings" })).json()).toEqual({ timeZone: "Europe/Bucharest" });
  });
});
