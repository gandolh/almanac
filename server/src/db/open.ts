import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { migrateSqlite } from "../../vendor/ward/ward-auth.js";
import { migrate } from "./migrations.js";

export type Db = Database.Database;

export const DB_FILE_NAME = "almanac.db";

/** `<dataDir>/almanac.db`: every table, so the backup is this one file. */
export function databasePath(dataDir: string): string {
  return join(dataDir, DB_FILE_NAME);
}

/**
 * Opens (creating it and its directory if needed) and migrates the database.
 * `:memory:` gives a private in-memory one.
 *
 * The vendored auth library's tables go first (`auth_migrations`, its own
 * runner, which `openAccounts` runs again as a no-op): Almanac's rows
 * reference `auth_users`, so it must exist before Almanac's migrations and
 * before any store writes. Both run in one transaction (`migrateAll`).
 */
export function openDb(path: string): Db {
  if (path !== ":memory:" && path !== "") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  try {
    db.pragma("journal_mode = WAL");
    // Off by default in SQLite, per connection: without it the cascades in the schema do nothing.
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    migrateAll(db);
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}

/**
 * The auth library's migrations, then Almanac's, in one `BEGIN IMMEDIATE`
 * transaction. Each runner reads its version before writing, so without the
 * lock two processes opening a fresh database could both read "none" and both
 * run the first migration; with it the second waits (`busy_timeout`) and finds
 * nothing to do. The library's runner nests its savepoints under it.
 */
export function migrateAll(db: Db): void {
  db.transaction(() => {
    migrateSqlite(db);
    migrate(db);
  }).immediate();
}
