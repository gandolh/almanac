import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, migrations } from "./migrations.js";
import { databasePath, migrateAll, openDb, type Db } from "./open.js";

const opened: Db[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "almanac-db-"));
  dirs.push(dir);
  return dir;
}

function open(path = ":memory:"): Db {
  const db = openDb(path);
  opened.push(db);
  return db;
}

const version = (db: Database.Database) => db.pragma("user_version", { simple: true });

function tables(db: Database.Database): string[] {
  return db
    .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name);
}

describe("openDb", () => {
  it("creates <dataDir>/almanac.db, its directory included, in WAL mode with foreign keys on", () => {
    const dataDir = join(tempDir(), "nested", "data");
    const db = open(databasePath(dataDir));
    expect(existsSync(join(dataDir, "almanac.db"))).toBe(true);
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(version(db)).toBe(migrations.length);
  });

  it("leaves a migrated database as it is on the next open", () => {
    const path = databasePath(tempDir());
    openDb(path).close();
    const second = open(path);
    expect(version(second)).toBe(migrations.length);
  });
});

describe("migrate", () => {
  it("applies each entry in order and records the version", () => {
    const db = new Database(":memory:");
    opened.push(db);
    migrate(db, ["CREATE TABLE a (x INTEGER)", "CREATE TABLE b (y INTEGER)"]);
    expect(version(db)).toBe(2);
    expect(tables(db)).toEqual(["a", "b"]);
  });

  it("applies only the entries it has not run", () => {
    const db = new Database(":memory:");
    opened.push(db);
    migrate(db, ["CREATE TABLE a (x INTEGER)"]);
    migrate(db, ["CREATE TABLE a (x INTEGER)", "CREATE TABLE b (y INTEGER)"]);
    expect(version(db)).toBe(2);
    expect(tables(db)).toEqual(["a", "b"]);
  });

  it("rolls an entry back whole when it fails, and keeps the version", () => {
    const db = new Database(":memory:");
    opened.push(db);
    migrate(db, ["CREATE TABLE a (x INTEGER)"]);
    expect(() => migrate(db, ["CREATE TABLE a (x INTEGER)", "CREATE TABLE b (y INTEGER); NOT SQL"])).toThrow();
    expect(version(db)).toBe(1);
    expect(tables(db)).toEqual(["a"]);
  });

  it("refuses a database newer than the server", () => {
    const db = new Database(":memory:");
    opened.push(db);
    migrate(db, ["CREATE TABLE a (x INTEGER)"]);
    expect(() => migrate(db, [])).toThrow(/schema version 1, but this server only knows 0/);
  });
});

/**
 * `db`, where the first call of `method` whose first argument matches `when`
 * runs `rival` straight after it: another process that opened the same file
 * at the same moment and got in between that call and the next.
 */
function interleaved(db: Db, method: "pragma" | "prepare", when: RegExp, rival: () => void): Db {
  let fired = false;
  return new Proxy(db, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      if (prop !== method) return value.bind(target);
      return (...args: unknown[]) => {
        const result: unknown = value.apply(target, args);
        if (!fired && when.test(String(args[0]))) {
          fired = true;
          rival();
        }
        return result;
      };
    },
  });
}

/** A second connection to `path` that gives up at once on a locked database, as a second process would after its busy timeout. */
function impatient(path: string): Db {
  const db = new Database(path, { timeout: 0 });
  db.pragma("journal_mode = WAL");
  opened.push(db);
  return db;
}

describe("two processes opening a fresh database at once", () => {
  it("run migration 1 once: the second waits for the first, then has nothing to do", () => {
    const path = databasePath(tempDir());
    const list = ["CREATE TABLE a (x INTEGER)"];
    const first = impatient(path);
    let refused: unknown;
    const second = interleaved(impatient(path), "pragma", /^user_version$/, () => {
      // The first reads the version just after the second did, and finds the database taken.
      try {
        migrate(first, list);
      } catch (error) {
        refused = error;
      }
    });
    migrate(second, list);
    expect(refused).toMatchObject({ code: "SQLITE_BUSY" });
    migrate(first, list);
    expect(version(first)).toBe(1);
    expect(tables(first)).toEqual(["a"]);
  });

  it("covers the auth library's migrations too", () => {
    const path = databasePath(tempDir());
    const first = impatient(path);
    let refused: unknown;
    // Between the auth library reading its version and running its first migration.
    const second = interleaved(impatient(path), "prepare", /^INSERT INTO auth_migrations/, () => {
      try {
        migrateAll(first);
      } catch (error) {
        refused = error;
      }
    });
    migrateAll(second);
    expect(refused).toMatchObject({ code: "SQLITE_BUSY" });
    migrateAll(first);
    expect(version(first)).toBe(migrations.length);
    expect(tables(first)).toEqual(expect.arrayContaining(["auth_users", "calendars", "events"]));
  });
});
