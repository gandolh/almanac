import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { migrate } from "./migrations.js";

export type Db = Database.Database;

export const DB_FILE_NAME = "almanac.db";

/** `<dataDir>/almanac.db`: every table, so the backup is this one file. */
export function databasePath(dataDir: string): string {
  return join(dataDir, DB_FILE_NAME);
}

/** Opens (creating it and its directory if needed) and migrates the database. `:memory:` gives a private in-memory one. */
export function openDb(path: string): Db {
  if (path !== ":memory:" && path !== "") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  try {
    db.pragma("journal_mode = WAL");
    // Off by default in SQLite, per connection: without it the cascades in the schema do nothing.
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    migrate(db);
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}
