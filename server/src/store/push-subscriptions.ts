import { PUSH_SUBSCRIPTIONS_PER_USER } from "@almanac/shared";
import type { Db } from "../db/open.js";

/** A browser's push subscription: where to send, and the keys to encrypt with. */
export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface StoredPushSubscription extends PushSubscriptionKeys {
  createdAt: string;
  /** When a push to it last went through; null until one has. */
  lastSuccessAt: string | null;
}

/**
 * The push subscriptions store (brief 14): the only module that runs SQL on
 * `push_subscriptions`. A subscription is keyed by its endpoint, which is one
 * browser's, and belongs to the user who saved it last.
 */
export interface PushSubscriptionStore {
  /**
   * Saves this browser's subscription for `userId`. An endpoint already stored
   * goes to `userId` with the new keys, whoever had it: the browser knows its
   * own subscription best, and a browser someone else signed in on must stop
   * getting the first user's reminders. Moving from another user, it counts as
   * `userId`'s newest. Past `PUSH_SUBSCRIPTIONS_PER_USER`, the oldest go.
   */
  save(userId: string, subscription: PushSubscriptionKeys): void;
  /** Deletes the endpoint only if `userId` holds it. True when a row went. */
  remove(userId: string, endpoint: string): boolean;
  /** The user's subscriptions, oldest first. */
  list(userId: string): StoredPushSubscription[];
  /** The push service says the endpoint is gone for good (404 or 410): delete it, whoever held it. */
  forget(endpoint: string): void;
  /** A push to the endpoint went through: note when. */
  markDelivered(endpoint: string): void;
}

interface Row {
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
  lastSuccessAt: string | null;
}

export function createPushSubscriptionStore(db: Db, now: () => Date = () => new Date()): PushSubscriptionStore {
  const holderOf = db.prepare<[string], { userId: string }>("SELECT user_id AS userId FROM push_subscriptions WHERE endpoint = ?");
  const insertRow = db.prepare<[Record<string, string>]>(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
    VALUES (@userId, @endpoint, @p256dh, @auth, @at)`);
  const rekeyRow = db.prepare<[Record<string, string>]>(
    "UPDATE push_subscriptions SET p256dh = @p256dh, auth = @auth WHERE endpoint = @endpoint",
  );
  const trimRows = db.prepare<[string, string, number]>(`
    DELETE FROM push_subscriptions WHERE user_id = ? AND id NOT IN (
      SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT ?)`);
  const listRows = db.prepare<[string], Row>(`
    SELECT endpoint, p256dh, auth, created_at AS createdAt, last_success_at AS lastSuccessAt
    FROM push_subscriptions WHERE user_id = ? ORDER BY id`);
  const deleteOwn = db.prepare<[string, string]>("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?");
  const deleteAny = db.prepare<[string]>("DELETE FROM push_subscriptions WHERE endpoint = ?");
  const delivered = db.prepare<[string, string]>("UPDATE push_subscriptions SET last_success_at = ? WHERE endpoint = ?");

  const save = db.transaction((userId: string, { endpoint, p256dh, auth }: PushSubscriptionKeys) => {
    const holder = holderOf.get(endpoint)?.userId;
    if (holder === userId) {
      // The same browser and user again: new keys, same place in line.
      rekeyRow.run({ endpoint, p256dh, auth });
    } else {
      // New here, or moving from another user: a fresh row, so it is this user's newest and the trim keeps it.
      if (holder !== undefined) deleteAny.run(endpoint);
      insertRow.run({ userId, endpoint, p256dh, auth, at: now().toISOString() });
    }
    trimRows.run(userId, userId, PUSH_SUBSCRIPTIONS_PER_USER);
  });

  return {
    save(userId, subscription) {
      save(userId, subscription);
    },
    remove: (userId, endpoint) => deleteOwn.run(endpoint, userId).changes > 0,
    list: (userId) => listRows.all(userId),
    forget(endpoint) {
      deleteAny.run(endpoint);
    },
    markDelivered(endpoint) {
      delivered.run(now().toISOString(), endpoint);
    },
  };
}
