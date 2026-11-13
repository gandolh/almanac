import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openDb } from "../../db/open.js";
import { createFeedTokenStore } from "./store.js";
import {
  FEED_TOKEN_BYTES,
  FEED_TOKEN_LENGTH,
  generateFeedToken,
  hashFeedToken,
  isFeedTokenShaped,
  sameFeedTokenHash,
} from "./token.js";

describe("a feed token", () => {
  it("is 32 random bytes as 43 base64url characters, different every time", () => {
    const tokens = Array.from({ length: 200 }, generateFeedToken);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, "base64url")).toHaveLength(FEED_TOKEN_BYTES);
      expect(isFeedTokenShaped(token)).toBe(true);
    }
    expect(FEED_TOKEN_LENGTH).toBe(43);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("is told apart from what can't be one by its shape", () => {
    const token = generateFeedToken();
    for (const wrong of ["", token.slice(1), `${token}A`, `${token.slice(1)}=`, `${token.slice(1)}/`, "a".repeat(64)]) {
      expect(isFeedTokenShaped(wrong)).toBe(false);
    }
  });

  it("is kept as its SHA-256, which is never the token", () => {
    const token = generateFeedToken();
    const hash = hashFeedToken(token);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashFeedToken(token)).toBe(hash);
    expect(hashFeedToken(generateFeedToken())).not.toBe(hash);
  });

  it("compares hashes of equal length only, and refuses a different or shorter one", () => {
    const hash = hashFeedToken(generateFeedToken());
    expect(sameFeedTokenHash(hash, hash)).toBe(true);
    expect(sameFeedTokenHash(hash, hashFeedToken(generateFeedToken()))).toBe(false);
    expect(sameFeedTokenHash(hash, hash.slice(0, 62))).toBe(false);
    expect(sameFeedTokenHash(hash, `${hash.slice(0, 63)}x`)).toBe(false);
    expect(sameFeedTokenHash(hash, "")).toBe(false);
  });
});

describe("the feed store", () => {
  function store() {
    const db = openDb(":memory:");
    for (const id of ["u1", "u2"]) {
      db.prepare(
        "INSERT INTO auth_users (id, username, username_folded, role, created_at, updated_at) VALUES (?, ?, ?, 'user', 0, 0)",
      ).run(id, id, id);
    }
    let tick = 0;
    return { db, feeds: createFeedTokenStore(db, () => new Date(Date.UTC(2026, 10, 13, 12, 0, tick++))) };
  }

  it("keeps the hash and never the token, and finds the user by the token", () => {
    const { db, feeds } = store();
    expect(feeds.state("u1")).toEqual({ on: false, createdAt: null });
    const token = generateFeedToken();
    const createdAt = feeds.replace("u1", token);
    expect(feeds.state("u1")).toEqual({ on: true, createdAt });
    const stored = db.prepare("SELECT * FROM feed_tokens").all();
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored).toEqual([{ user_id: "u1", token_hash: hashFeedToken(token), created_at: createdAt }]);
    expect(feeds.userFor(token)).toBe("u1");
    expect(feeds.userFor(generateFeedToken())).toBeUndefined();
    db.close();
  });

  it("replaces the user's one link, so the old token opens nothing", () => {
    const { db, feeds } = store();
    const old = generateFeedToken();
    feeds.replace("u1", old);
    const next = generateFeedToken();
    feeds.replace("u1", next);
    expect(feeds.userFor(old)).toBeUndefined();
    expect(feeds.userFor(next)).toBe("u1");
    expect(db.prepare("SELECT count(*) AS n FROM feed_tokens").get()).toEqual({ n: 1 });
    db.close();
  });

  it("keeps each user's link to its user, and forgets it when turned off", () => {
    const { db, feeds } = store();
    const mine = generateFeedToken();
    const theirs = generateFeedToken();
    feeds.replace("u1", mine);
    feeds.replace("u2", theirs);
    expect(feeds.userFor(mine)).toBe("u1");
    expect(feeds.userFor(theirs)).toBe("u2");
    expect(feeds.remove("u1")).toBe(true);
    expect(feeds.remove("u1")).toBe(false);
    expect(feeds.userFor(mine)).toBeUndefined();
    expect(feeds.userFor(theirs)).toBe("u2");
    expect(feeds.state("u1")).toEqual({ on: false, createdAt: null });
    db.close();
  });

  it("goes with its user", () => {
    const { db, feeds } = store();
    const token = generateFeedToken();
    feeds.replace("u1", token);
    db.prepare("DELETE FROM auth_users WHERE id = 'u1'").run();
    expect(feeds.userFor(token)).toBeUndefined();
    db.close();
  });
});
