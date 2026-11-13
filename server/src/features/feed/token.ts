import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The secret in a feed link. A calendar app can't sign in, so whoever holds
 * the link reads the feed: 32 bytes from the system's CSPRNG (256 bits), far
 * past guessing. The database keeps only its SHA-256, which is enough for a
 * secret this long (no salt or slow hash is needed: there is nothing to guess
 * from), so a copy of the database opens no feed and the link is shown once.
 */

/** The bytes in a token. */
export const FEED_TOKEN_BYTES = 32;

/** A token's length as base64url without padding: 43 characters. */
export const FEED_TOKEN_LENGTH = Math.ceil((FEED_TOKEN_BYTES * 4) / 3);

const TOKEN_SHAPE = new RegExp(`^[A-Za-z0-9_-]{${FEED_TOKEN_LENGTH}}$`);

/** A new token, base64url. */
export function generateFeedToken(): string {
  return randomBytes(FEED_TOKEN_BYTES).toString("base64url");
}

/** Whether `value` looks like a token at all. A request that fails this is a 404 without a query. */
export function isFeedTokenShaped(value: string): boolean {
  return TOKEN_SHAPE.test(value);
}

/** What the database keeps for a token: its SHA-256, as 64 hex characters. */
export function hashFeedToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Whether two stored hashes are the same, in time that doesn't depend on
 * where they differ. A value of another length (or not hex) is never equal,
 * and is refused before `timingSafeEqual`, which throws on unequal lengths.
 */
export function sameFeedTokenHash(stored: string, presented: string): boolean {
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(presented, "hex");
  if (a.length !== 32 || b.length !== 32) return false;
  return timingSafeEqual(a, b);
}
