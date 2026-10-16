import { createAccounts, createSqliteStore, seedUsers, type Accounts } from "../../vendor/ward/ward-auth.js";
import type { Db } from "../db/open.js";

/**
 * Almanac's local accounts, on the vendored ward-auth library (brief 02).
 * Almanac has several users and no roles: each sees only what is theirs, and
 * nothing checks a role. The library keeps a role on every user, and this is
 * the only one. A user made by a first "Sign in with Ward" gets it too
 * (`app.ts`), whatever Ward's grant names.
 */
export const USER_ROLE = "user";

/**
 * The accounts on the app's own database. The library migrates its own tables
 * (`auth_users`, `auth_sessions`, `auth_ward_links`, tracked in
 * `auth_migrations`) on this call, beside Almanac's; it never reads or sets
 * `PRAGMA user_version`, which is Almanac's (`db/migrations.ts`).
 */
export function openAccounts(db: Db): Accounts {
  return createAccounts({ store: createSqliteStore(db) });
}

/**
 * Create a user, unless one of that name (case-folded) exists, which is then
 * left exactly as it is: no password reset. True when it was created.
 * Throws the library's `UsernamePolicyError` or `PasswordPolicyError` (fewer
 * than 8 characters, say) for a value it won't store.
 */
export async function seedUser(accounts: Accounts, user: { username: string; password: string }): Promise<boolean> {
  const result = await seedUsers(accounts, [{ ...user, role: USER_ROLE }]);
  return result.created.length > 0;
}
