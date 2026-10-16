import type { Database } from "better-sqlite3";

/**
 * Applied in order on boot, each in its own transaction, tracked in
 * `PRAGMA user_version`. Never edit a shipped entry; append a new one with a
 * comment naming its brief.
 *
 * Empty until the first brief that owns a table (brief 03).
 */
export const migrations: readonly string[] = [];

/** Brings the schema up to `list.length`, tracked in `PRAGMA user_version`. */
export function migrate(db: Database, list: readonly string[] = migrations): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  if (current > list.length) {
    throw new Error(
      `The database is at schema version ${current}, but this server only knows ${list.length}. Run a newer server.`,
    );
  }
  list.slice(current).forEach((sql, index) => {
    const version = current + index + 1;
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    })();
  });
}
