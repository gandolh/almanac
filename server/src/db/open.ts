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
 * before any store writes.
 */
export function openDb(path: string): Db {
  if (path !== ":memory:" && path !== "") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  try {
    db.pragma("journal_mode = WAL");
    // Off by default in SQLite, per connection: without it the cascades in the schema do nothing.
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    migrateSqlite(db);
    migrate(db);
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}
