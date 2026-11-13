import type { FeedState } from "@almanac/shared";
import type { Db } from "../../db/open.js";
import { hashFeedToken, sameFeedTokenHash } from "./token.js";

/**
 * The feed store: the only module that runs SQL on `feed_tokens`. A user has
 * one row while their feed is on, holding the hash of the secret in its link;
 * the secret itself is never stored, so it can't be read back.
 */
export interface FeedTokenStore {
  /** Whether the user's feed is on, and since its link was made (turned on, or given a new link). */
  state(userId: string): FeedState;
  /** Keeps `token`'s hash as the user's one link, replacing any earlier one. Answers when. */
  replace(userId: string, token: string): string;
  /** Turns the user's feed off: the link stops working. `false` when it was off already. */
  remove(userId: string): boolean;
  /** The user whose link holds `token`, or `undefined` for a token no feed has. */
  userFor(token: string): string | undefined;
}

/** A hash no token has, compared against when nothing matched, so a miss costs what a hit does. */
const NO_HASH = "0".repeat(64);

export function createFeedTokenStore(db: Db, now: () => Date = () => new Date()): FeedTokenStore {
  const createdAtOf = db.prepare<[string], { createdAt: string }>(
    "SELECT created_at AS createdAt FROM feed_tokens WHERE user_id = ?",
  );
  const upsert = db.prepare<[string, string, string]>(`
    INSERT INTO feed_tokens (user_id, token_hash, created_at) VALUES (?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at`);
  const deleteRow = db.prepare<[string]>("DELETE FROM feed_tokens WHERE user_id = ?");
  const byHash = db.prepare<[string], { userId: string; tokenHash: string }>(
    "SELECT user_id AS userId, token_hash AS tokenHash FROM feed_tokens WHERE token_hash = ?",
  );

  return {
    state(userId) {
      const createdAt = createdAtOf.get(userId)?.createdAt ?? null;
      return { on: createdAt !== null, createdAt };
    },
    replace(userId, token) {
      const at = now().toISOString();
      upsert.run(userId, hashFeedToken(token), at);
      return at;
    },
    remove: (userId) => deleteRow.run(userId).changes > 0,
    userFor(token) {
      const presented = hashFeedToken(token);
      const row = byHash.get(presented);
      // The index finds the row by the hash, never by the secret; the stored hash is then compared in constant time.
      const same = sameFeedTokenHash(row?.tokenHash ?? NO_HASH, presented);
      return row !== undefined && same ? row.userId : undefined;
    },
  };
}
