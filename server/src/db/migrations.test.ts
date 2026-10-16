import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, migrations } from "./migrations.js";
import { databasePath, openDb, type Db } from "./open.js";

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
