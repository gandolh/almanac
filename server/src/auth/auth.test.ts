import { generateKeyPairSync } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { PUBLIC_ROUTES, SESSION_COOKIE } from "../app.js";
import { sessionCookieFrom, startSignedInApp, startTestApp, type SignedInTestApp, type TestApp } from "../testing/testApp.js";
import { currentUserId } from "./guard.js";

/**
 * Signing in and the guard, through the real app: the plugin's `/auth/*`
 * routes, its session guard, and Almanac's origin guard. Almanac has no
 * routes of its own yet (brief 03 adds them), so a test that needs one adds
 * it to the test app before the first request.
 */

let t: TestApp | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

async function signedIn(env: NodeJS.ProcessEnv = {}): Promise<SignedInTestApp> {
  const app = await startSignedInApp(env);
  t = app;
  return app;
}

/** A test app with two routes of a later brief's kind: a write, and one that says who is asking. */
async function withRoutes(): Promise<TestApp> {
  t = await startTestApp();
  t.app.post("/api/test/write", async (_request, reply) => reply.code(201).send({ written: true }));
  t.app.get("/api/test/me", async (request) => ({ id: currentUserId(request) }));
  return t;
}

/** The plugin's own routes that need no session (the plugin adds them to `PUBLIC_ROUTES` itself). */
const AUTH_PUBLIC = ["POST /auth/login", "POST /auth/logout", "GET /auth/session", "POST /auth/ward/start", "GET /auth/ward/callback"];

/**
 * Every route the app serves, as `"METHOD /pattern"`, read from Fastify's own
 * listing, so a route a later brief adds is in it without touching this test.
 * HEAD (GET's twin) and OPTIONS (always public, and never given a handler) are left out.
 */
function routesOf(app: FastifyInstance): string[] {
  const routes: string[] = [];
  const stack: string[] = [];
  for (const line of app.printRoutes({ commonPrefix: false }).split("\n")) {
    const match = /^(.*?)[├└]── (\S+)(?: \(([^)]*)\))?$/.exec(line);
    if (!match) continue;
    const depth = (match[1] ?? "").length / 4;
    stack.length = depth;
    stack.push(match[2] ?? "");
    const path = stack.join("");
    for (const method of (match[3] ?? "").split(", ")) {
      if (method !== "" && method !== "HEAD" && method !== "OPTIONS") routes.push(`${method} ${path}`);
    }
  }
  return routes;
}

/** A Ward client key in the shape `createWardClient` reads (base64url of a private Ed25519 JWK), made now, for a test only. */
function testClientKey(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return Buffer.from(JSON.stringify({ ...privateKey.export({ format: "jwk" }), kid: "test-key" })).toString("base64url");
}

/** The five settings, as Ward's local seed writes them. Nothing listens at the issuer (the discard port on loopback). */
function wardSettings(): NodeJS.ProcessEnv {
  return {
    WARD_OIDC_ISSUER: "http://127.0.0.1:9/ward-api/oidc",
    WARD_OIDC_CLIENT_ID: "almanac",
    WARD_OIDC_CLIENT_KEY: testClientKey(),
    WARD_OIDC_REDIRECT_URI: "http://localhost:5177/almanac-api/auth/ward/callback",
    WARD_OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:5177/almanac/",
  };
}

describe("the guard", () => {
  it("answers the health check without a session", async () => {
    t = await startTestApp();
    const res = await t.app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it.each([
    ["without Ward", () => ({}), ["POST /auth/password"]],
    ["with Ward", wardSettings, ["POST /auth/password", "POST /auth/ward/link", "POST /auth/ward/unlink", "POST /auth/ward/set-password"]],
  ])("refuses every other route without a session, whichever brief added it (%s)", async (_, env, authRoutes) => {
    t = await startTestApp(env());
    const routes = routesOf(t.app);
    const guarded = routes.filter((route) => !PUBLIC_ROUTES.includes(route) && !AUTH_PUBLIC.includes(route));
    // The listing is read right: the plugin's guarded routes are in it.
    expect(guarded).toEqual(expect.arrayContaining(authRoutes));
    for (const route of guarded) {
      const [method = "", pattern = ""] = route.split(" ");
      const url = pattern.replace(/:[^/]+/g, "1");
      const res = await t.app.inject({ method: method as "GET", url, payload: method === "GET" || method === "DELETE" ? undefined : {} });
      expect({ route, status: res.statusCode, body: res.json() as unknown }).toEqual({ route, status: 401, body: { error: "unauthorized" } });
    }
  });

  it("refuses a protected route without a cookie, and lets the session through", async () => {
    const app = await withRoutes();
    const out = await app.app.inject({ method: "GET", url: "/api/test/me" });
    expect(out.statusCode).toBe(401);
    expect(out.json()).toEqual({ error: "unauthorized" });
    const owner = await app.signInAs("owner");
    const res = await owner.inject({ method: "GET", url: "/api/test/me" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: expect.any(String) });
  });

  it("refuses an unknown route without a session too, and says 404 with one", async () => {
    const app = await signedIn();
    expect((await app.app.inject({ method: "GET", url: "/api/nothing-here" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/nothing-here" })).statusCode).toBe(404);
  });

  it("refuses a cookie that names no session, and clears it", async () => {
    t = await startTestApp();
    const res = await t.app.inject({ method: "GET", url: "/api/nothing-here", headers: { cookie: `${SESSION_COOKIE}=made-up` } });
    expect(res.statusCode).toBe(401);
    expect(String(res.headers["set-cookie"])).toMatch(new RegExp(`^${SESSION_COOKIE}=;.*Max-Age=0`));
  });

  it("ends the session on sign-out", async () => {
    const app = await withRoutes();
    const owner = await app.signInAs("owner");
    const out = await owner.inject({ method: "POST", url: "/auth/logout" });
    expect(out.statusCode).toBe(204);
    expect((await owner.inject({ method: "GET", url: "/api/test/me" })).statusCode).toBe(401);
  });
});

describe("several users", () => {
  it("are each signed in as themselves, with different ids", async () => {
    const app = await withRoutes();
    const ana = await app.signInAs("ana");
    const ion = await app.signInAs("ion");
    const anaId = (await ana.inject({ method: "GET", url: "/api/test/me" })).json<{ id: string }>().id;
    const ionId = (await ion.inject({ method: "GET", url: "/api/test/me" })).json<{ id: string }>().id;
    expect(anaId).not.toBe(ionId);
    expect((await ana.inject({ method: "GET", url: "/auth/session" })).json()).toMatchObject({ user: { id: anaId, username: "ana", role: "user" } });
    expect((await ion.inject({ method: "GET", url: "/auth/session" })).json()).toMatchObject({ user: { id: ionId, username: "ion", role: "user" } });
  });

  it("sign in as the same id every time", async () => {
    const app = await withRoutes();
    const first = await app.signInAs("ana");
    const again = await app.signInAs("ana");
    expect(again.cookie).not.toBe(first.cookie);
    const ids = await Promise.all([first, again].map(async (user) => (await user.inject({ method: "GET", url: "/api/test/me" })).json<{ id: string }>().id));
    expect(ids[0]).toBe(ids[1]);
  });
});

describe("signing in", () => {
  it("sets almanac_session on the API prefix: HttpOnly, SameSite=Lax, not Secure on plain-HTTP localhost", async () => {
    t = await startTestApp();
    await t.createUser();
    const res = await t.app.inject({ method: "POST", url: "/auth/login", payload: t.owner });
    expect(res.statusCode).toBe(200);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[^;]+;`));
    expect(cookie).toContain("Path=/almanac-api");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
    expect(res.json()).toMatchObject({ user: { username: "owner", role: "user", hasPassword: true }, ward: { enabled: false, linked: false } });
  });

  it("is Secure behind an https origin", async () => {
    t = await startTestApp({ PUBLIC_ORIGIN: "https://example.com" });
    await t.createUser();
    const res = await t.app.inject({ method: "POST", url: "/auth/login", payload: t.owner });
    expect(String(res.headers["set-cookie"])).toContain("Secure");
  });

  it("gives one answer for a wrong password and an unknown user, and no cookie", async () => {
    t = await startTestApp();
    await t.createUser();
    for (const payload of [
      { username: "owner", password: "not the password" },
      { username: "nobody", password: t.owner.password },
    ]) {
      const res = await t.app.inject({ method: "POST", url: "/auth/login", payload });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: "invalid_credentials" });
      expect(sessionCookieFrom(res)).toBeUndefined();
    }
  });

  it("has no sign-up route", async () => {
    const app = await signedIn();
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: { username: "someone", password: "a long password" } });
    expect(res.statusCode).toBe(404);
  });

  it("says who is signed in, and nobody without a session", async () => {
    const app = await signedIn();
    const out = await app.app.inject({ method: "GET", url: "/auth/session" });
    expect(out.statusCode).toBe(200);
    expect(out.json()).toEqual({ user: null, session: null, ward: { enabled: false, linked: false } });
    const res = await app.inject({ method: "GET", url: "/auth/session" });
    expect(res.json()).toMatchObject({ user: { username: "owner" }, session: { origin: "local" } });
  });

  it("changes the password: the old one stops working, the new one works, other sessions end", async () => {
    const app = await signedIn();
    const other = await app.signIn();
    const newPassword = `${app.owner.password}-changed`;
    const wrong = await app.inject({ method: "POST", url: "/auth/password", payload: { currentPassword: "wrong one", newPassword } });
    expect(wrong.json()).toEqual({ error: "invalid_credentials" });
    const res = await app.inject({ method: "POST", url: "/auth/password", payload: { currentPassword: app.owner.password, newPassword } });
    expect(res.statusCode).toBe(204);

    expect((await app.inject({ method: "GET", url: "/auth/session" })).json()).toMatchObject({ user: { username: "owner" } });
    expect((await app.app.inject({ method: "GET", url: "/auth/session", headers: { cookie: other } })).json()).toMatchObject({ user: null });
    const old = await app.app.inject({ method: "POST", url: "/auth/login", payload: app.owner });
    expect(old.statusCode).toBe(401);
    const fresh = await app.app.inject({ method: "POST", url: "/auth/login", payload: { username: "owner", password: newPassword } });
    expect(fresh.statusCode).toBe(200);
  });
});

describe("cross-origin writes", () => {
  it.each([["https://example.net"], ["null"], ["http://localhost:5177.example.net"], ["https://localhost:5177"]])(
    "refuses a write from Origin %s with Almanac's error",
    async (origin) => {
      const app = await withRoutes();
      const owner = await app.signInAs("owner");
      const res = await owner.inject({ method: "POST", url: "/api/test/write", headers: { origin }, payload: {} });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: { code: "forbidden", message: "Almanac only accepts changes from its own pages." } });
    },
  );

  it.each([["cross-site"], ["same-site"]])("refuses a write with Sec-Fetch-Site %s", async (site) => {
    const app = await withRoutes();
    const owner = await app.signInAs("owner");
    const res = await owner.inject({ method: "POST", url: "/api/test/write", headers: { "sec-fetch-site": site }, payload: {} });
    expect(res.statusCode).toBe(403);
  });

  it("accepts the app's own origin, and a caller that sends neither header", async () => {
    const app = await withRoutes();
    const owner = await app.signInAs("owner");
    const own = { origin: app.config.publicOrigin, "sec-fetch-site": "same-origin" };
    expect((await owner.inject({ method: "POST", url: "/api/test/write", headers: own, payload: {} })).statusCode).toBe(201);
    expect((await owner.inject({ method: "POST", url: "/api/test/write", payload: {} })).statusCode).toBe(201);
  });

  it("lets a read through: it changes nothing, and the browser keeps the answer from the other page", async () => {
    const app = await withRoutes();
    const owner = await app.signInAs("owner");
    const res = await owner.inject({ method: "GET", url: "/api/test/me", headers: { origin: "https://example.net", "sec-fetch-site": "cross-site" } });
    expect(res.statusCode).toBe(200);
  });

  it("leaves the auth routes to the plugin's own check", async () => {
    t = await startTestApp();
    await t.createUser();
    const res = await t.app.inject({ method: "POST", url: "/auth/login", headers: { origin: "https://example.net" }, payload: t.owner });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "cross_site" });
  });
});

describe("Sign in with Ward", () => {
  it("is off without WARD_OIDC_ISSUER: the session says so, and its routes are not there", async () => {
    const app = await signedIn();
    expect((await app.inject({ method: "GET", url: "/auth/session" })).json()).toMatchObject({ ward: { enabled: false } });
    expect((await app.inject({ method: "POST", url: "/auth/ward/link" })).statusCode).toBe(404);
    expect((await app.app.inject({ method: "POST", url: "/auth/ward/start", payload: {} })).statusCode).toBe(401);
  });

  it("is on with the five settings, and starts while Ward is unreachable", async () => {
    const app = await signedIn(wardSettings());
    expect((await app.app.inject({ method: "GET", url: "/auth/session" })).json()).toMatchObject({ ward: { enabled: true, linked: false } });
    expect((await app.inject({ method: "GET", url: "/auth/session" })).json()).toMatchObject({ ward: { enabled: true, linked: false } });
    // Nothing answers at the issuer: the button's first request says so, and local sign-in kept working.
    const start = await app.app.inject({ method: "POST", url: "/auth/ward/start", payload: { returnTo: "/almanac/" } });
    expect(start.statusCode).toBe(503);
    expect(start.json()).toEqual({ error: "ward_unavailable" });
  });
});
