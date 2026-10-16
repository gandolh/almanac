import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrations } from "../db/migrations.js";
import { openDb, type Db } from "../db/open.js";
import { USER_ROLE, openAccounts, seedUser } from "./accounts.js";

let db: Db | undefined;
afterEach(() => {
  db?.close();
  db = undefined;
});

function accounts() {
  db = openDb(":memory:");
  return openAccounts(db);
}

const password = () => randomBytes(12).toString("base64url");

describe("seedUser", () => {
  it("creates a user with the one role, who can then sign in", async () => {
    const store = accounts();
    const secret = password();
    expect(await seedUser(store, { username: "ana", password: secret })).toBe(true);
    expect(await store.verifyCredentials("ana", secret)).toMatchObject({ username: "ana", role: USER_ROLE, hasPassword: true });
  });

  it("leaves an existing user exactly as it is when seeded twice, password and id included", async () => {
    const store = accounts();
    const first = password();
    await seedUser(store, { username: "ana", password: first });
    const before = await store.findUserByUsername("ana");
    expect(await seedUser(store, { username: "Ana", password: password() })).toBe(false);
    expect(await store.findUserByUsername("ana")).toEqual(before);
    expect(await store.verifyCredentials("ana", first)).toEqual(before);
  });

  it("gives two users two different ids", async () => {
    const store = accounts();
    await seedUser(store, { username: "ana", password: password() });
    await seedUser(store, { username: "ion", password: password() });
    const ana = await store.findUserByUsername("ana");
    const ion = await store.findUserByUsername("ion");
    expect(ana?.id).toEqual(expect.any(String));
    expect(ion?.id).toEqual(expect.any(String));
    expect(ana?.id).not.toBe(ion?.id);
  });

  it("refuses a password the library won't store", async () => {
    await expect(seedUser(accounts(), { username: "ana", password: "short" })).rejects.toThrow("at least 8 characters");
  });

  it("keeps the library's tables out of Almanac's schema version", async () => {
    accounts();
    expect(db?.pragma("user_version", { simple: true })).toBe(migrations.length);
    const tables = db?.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'auth_%'").all();
    expect(tables).toEqual(expect.arrayContaining([{ name: "auth_users" }, { name: "auth_sessions" }]));
  });
});
