import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { AUTH_ROUTE_PREFIX, SESSION_COOKIE, buildApp } from "../app.js";
import { openAccounts, seedUser } from "../auth/accounts.js";
import { loadConfig, type Config } from "../config.js";
import { databasePath, openDb } from "../db/open.js";

/**
 * A whole app for tests, on a fresh temporary `DATA_DIR` so route tests never
 * touch `data/`. The overrides are environment values, as `loadConfig` reads them.
 *
 *     const t = await startTestApp();
 *     const res = await t.app.inject({ method: "GET", url: "/api/health" });
 *     await t.close();
 *
 * `close` stops the app and deletes the directory.
 *
 * Every route but `GET /api/health` needs a session (brief 02). A test that
 * is not about signing in starts a signed-in app and injects through it,
 * which adds the owner's session cookie:
 *
 *     const t = await startSignedInApp();
 *     const res = await t.inject({ method: "GET", url: "/api/calendars" });
 *
 * A test about one user not seeing another's rows signs a second one in:
 *
 *     const other = await t.signInAs("other");
 *     const res = await other.inject({ method: "GET", url: `/api/calendars/${id}` });
 *
 * `t.signIn(username)` and `t.signInAs(username)` create that user (once)
 * and sign in through the real `POST /auth/login`, as the login page does.
 * Every user's password is made up per app, at runtime.
 */

/** A user's credentials. The user exists only in this app's temporary database. */
export interface TestUser {
  username: string;
  password: string;
}

/** A user signed in to the test app, with their own session. */
export interface SignedInUser extends TestUser {
  /** The session's `Cookie` header value: `almanac_session=…`. */
  cookie: string;
  /** `app.inject` with this user's session cookie (a `cookie` header the test passes wins). */
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
}

export interface TestApp {
  app: FastifyInstance;
  config: Config;
  /** The temporary data directory. */
  dataDir: string;
  /** The user `signIn()` signs in when given no name. Created on first use. */
  owner: TestUser;
  /** Create the user (once, as the seed does) without signing in. Resolves to the credentials. */
  createUser(username?: string): Promise<TestUser>;
  /** Create the user if needed and sign in through `POST /auth/login`. Resolves to the `Cookie` header value. */
  signIn(username?: string): Promise<string>;
  /** `signIn`, with the user's credentials and an `inject` that carries the new session. */
  signInAs(username: string): Promise<SignedInUser>;
  close(): Promise<void>;
}

export interface SignedInTestApp extends TestApp {
  /** The owner's session `Cookie` header value: `almanac_session=…`. */
  cookie: string;
  /** `app.inject` with the owner's session cookie (a `cookie` header the test passes wins). */
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
}

/** The `name=value` pair of the session cookie a response set, if it set one. */
export function sessionCookieFrom(res: LightMyRequestResponse): string | undefined {
  const header = res.headers["set-cookie"];
  const lines = header === undefined ? [] : Array.isArray(header) ? header : [header];
  return lines.map((line) => line.split(";")[0] ?? "").find((pair) => pair.startsWith(`${SESSION_COOKIE}=`));
}

function madeUpPassword(): string {
  return randomBytes(12).toString("base64url");
}

export async function startTestApp(overrides: NodeJS.ProcessEnv = {}): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "almanac-test-"));
  try {
    const config = loadConfig({ DATA_DIR: dataDir, ...overrides });
    const app = await buildApp(config);
    const owner: TestUser = { username: "owner", password: madeUpPassword() };
    // By username as given; one password each, kept for as long as the app runs.
    const users = new Map<string, TestUser>([[owner.username, owner]]);
    const created = new Set<string>();

    async function createUser(username = owner.username): Promise<TestUser> {
      let user = users.get(username);
      if (user === undefined) {
        user = { username, password: madeUpPassword() };
        users.set(username, user);
      }
      if (!created.has(username)) {
        // A second connection, as a seed run against a live server would be.
        const db = openDb(databasePath(config.dataDir));
        try {
          await seedUser(openAccounts(db), user);
        } finally {
          db.close();
        }
        created.add(username);
      }
      return user;
    }

    async function signIn(username = owner.username): Promise<string> {
      const user = await createUser(username);
      const res = await app.inject({ method: "POST", url: `${AUTH_ROUTE_PREFIX}/login`, payload: user });
      const cookie = sessionCookieFrom(res);
      if (res.statusCode !== 200 || cookie === undefined) {
        throw new Error(`Signing in as ${username} answered ${res.statusCode} ${res.body}`);
      }
      return cookie;
    }

    return {
      app,
      config,
      dataDir,
      owner,
      createUser,
      signIn,
      async signInAs(username) {
        const cookie = await signIn(username);
        const user = await createUser(username);
        return {
          ...user,
          cookie,
          inject: (request) => app.inject({ ...request, headers: { cookie, ...request.headers } }),
        };
      },
      async close() {
        await app.close();
        await rm(dataDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(dataDir, { recursive: true, force: true });
    throw error;
  }
}

/** `startTestApp`, with the owner signed in: `inject` carries the owner's session cookie. */
export async function startSignedInApp(overrides: NodeJS.ProcessEnv = {}): Promise<SignedInTestApp> {
  const t = await startTestApp(overrides);
  try {
    const cookie = await t.signIn();
    return {
      ...t,
      cookie,
      inject: (request) => t.app.inject({ ...request, headers: { cookie, ...request.headers } }),
    };
  } catch (error) {
    await t.close();
    throw error;
  }
}
