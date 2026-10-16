import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { createSettingsStore, type SettingsStore } from "./settings.js";

let db: Db;
let store: SettingsStore;

function addUser(name: string): string {
  db.prepare(
    `INSERT INTO auth_users (id, username, username_folded, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'user', 0, 0)`,
  ).run(`id-${name}`, name, name);
  return `id-${name}`;
}

beforeEach(() => {
  db = openDb(":memory:");
  store = createSettingsStore(db);
});

afterEach(() => {
  db.close();
});

describe("settings", () => {
  it("answers Europe/Bucharest for a user who never set it, with no row", () => {
    const ana = addUser("ana");
    expect(store.get(ana)).toEqual({ timeZone: "Europe/Bucharest" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM user_settings").get()).toEqual({ n: 0 });
  });

  it("sets and changes the zone per user", () => {
    const ana = addUser("ana");
    const ion = addUser("ion");
    expect(store.set(ana, { timeZone: "America/New_York" })).toEqual({ timeZone: "America/New_York" });
    expect(store.set(ana, { timeZone: "Asia/Tokyo" })).toEqual({ timeZone: "Asia/Tokyo" });
    expect(store.get(ana)).toEqual({ timeZone: "Asia/Tokyo" });
    expect(store.get(ion)).toEqual({ timeZone: "Europe/Bucharest" });
  });

  it("leaves the settings alone for an empty patch", () => {
    const ana = addUser("ana");
    expect(store.set(ana, {})).toEqual({ timeZone: "Europe/Bucharest" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM user_settings").get()).toEqual({ n: 0 });
  });
});
