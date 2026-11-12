import { settingsSchema, type Settings } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { featureApp } from "../../testing/featureApp.js";
import { startSignedInApp, type SignedInTestApp } from "../../testing/testApp.js";
import { settingsRoutes } from "./routes.js";

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
    expect((await other.inject({ method: "GET", url: "/api/settings" })).json()).toEqual({
      timeZone: "Europe/Bucharest",
    });
  });

  it("refuses a zone that is not an IANA name, and unknown fields", async () => {
    for (const payload of [
      { timeZone: "+02:00" },
      { timeZone: "Atlantis/Capital" },
      { timeZone: 3 },
      { theme: "dark" },
    ]) {
      const res = await t.inject({ method: "PATCH", url: "/api/settings", payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json<{ error: { code: string; message: string } }>().error).toMatchObject({ code: "validation" });
    }
    expect((await t.inject({ method: "GET", url: "/api/settings" })).json()).toEqual({ timeZone: "Europe/Bucharest" });
  });
});

describe("the reply schema", () => {
  const app = async (row: unknown) =>
    featureApp(settingsRoutes, {
      settings: { get: () => row as Settings, set: () => row as Settings },
    });

  it("strips a field the schema doesn't name", async () => {
    const bare = await app({ timeZone: "Europe/Bucharest", internal: "secret" });
    const res = await bare.inject({ method: "GET", url: "/api/settings" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('{"timeZone":"Europe/Bucharest"}');
    await bare.close();
  });

  it("answers 500 with the fixed message, and no detail, for a reply that fails it", async () => {
    const bare = await app({ timeZone: 3 });
    const res = await bare.inject({ method: "GET", url: "/api/settings" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: "internal", message: "Something went wrong on the server." } });
    await bare.close();
  });

  it("keeps a thrown message out of the reply", async () => {
    const bare = await featureApp(settingsRoutes, {
      settings: {
        get: () => {
          throw new Error("no such table: user_settings");
        },
        set: () => ({ timeZone: "UTC" }),
      },
    });
    const res = await bare.inject({ method: "GET", url: "/api/settings" });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("user_settings");
    await bare.close();
  });
});
