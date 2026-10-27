import { PUSH_SUBSCRIPTIONS_PER_USER } from "@almanac/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { createPushSubscriptionStore, type PushSubscriptionStore } from "./push-subscriptions.js";

let db: Db;
let store: PushSubscriptionStore;
let clock: number;

function addUser(name: string): string {
  db.prepare(
    `INSERT INTO auth_users (id, username, username_folded, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'user', 0, 0)`,
  ).run(`id-${name}`, name, name);
  return `id-${name}`;
}

// Made-up endpoints and keys, shaped like a browser's.
const sub = (n: number, keys = "a") => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, p256dh: `p-${keys}`, auth: `a-${keys}` });
const endpoints = (userId: string) => store.list(userId).map((row) => row.endpoint);

beforeEach(() => {
  db = openDb(":memory:");
  clock = Date.parse("2026-10-27T10:00:00Z");
  store = createPushSubscriptionStore(db, () => new Date((clock += 1000)));
});

afterEach(() => {
  db.close();
});

describe("push subscriptions", () => {
  it("saves a browser's subscription for the user, oldest first", () => {
    const ana = addUser("ana");
    store.save(ana, sub(1));
    store.save(ana, sub(2));
    expect(store.list(ana)).toEqual([
      { ...sub(1), createdAt: "2026-10-27T10:00:01.000Z", lastSuccessAt: null },
      { ...sub(2), createdAt: "2026-10-27T10:00:02.000Z", lastSuccessAt: null },
    ]);
  });

  it("takes the new keys for an endpoint saved again, in the same place", () => {
    const ana = addUser("ana");
    store.save(ana, sub(1));
    store.save(ana, sub(2));
    store.save(ana, sub(1, "b"));
    expect(store.list(ana).map(({ endpoint, p256dh }) => [endpoint, p256dh])).toEqual([
      [sub(1).endpoint, "p-b"],
      [sub(2).endpoint, "p-a"],
    ]);
  });

  it("moves an endpoint to whoever saved it last", () => {
    const ana = addUser("ana");
    const ion = addUser("ion");
    store.save(ana, sub(1));
    store.save(ion, sub(1));
    expect(endpoints(ana)).toEqual([]);
    expect(endpoints(ion)).toEqual([sub(1).endpoint]);
  });

  it(`keeps a user's newest ${PUSH_SUBSCRIPTIONS_PER_USER}`, () => {
    const ana = addUser("ana");
    const ion = addUser("ion");
    store.save(ion, sub(100));
    for (let n = 1; n <= PUSH_SUBSCRIPTIONS_PER_USER + 2; n += 1) store.save(ana, sub(n));
    expect(endpoints(ana)).toEqual([3, 4, 5, 6, 7].map((n) => sub(n).endpoint));
    expect(endpoints(ion)).toEqual([sub(100).endpoint]);
  });

  it("an endpoint moving in counts as the user's newest, so the cap keeps it", () => {
    const ana = addUser("ana");
    const ion = addUser("ion");
    store.save(ion, sub(100));
    for (let n = 1; n <= PUSH_SUBSCRIPTIONS_PER_USER; n += 1) store.save(ana, sub(n));
    store.save(ana, sub(100));
    expect(endpoints(ana)).toEqual([2, 3, 4, 5, 100].map((n) => sub(n).endpoint));
  });

  it("removes only the user's own endpoint", () => {
    const ana = addUser("ana");
    const ion = addUser("ion");
    store.save(ana, sub(1));
    expect(store.remove(ion, sub(1).endpoint)).toBe(false);
    expect(endpoints(ana)).toEqual([sub(1).endpoint]);
    expect(store.remove(ana, sub(1).endpoint)).toBe(true);
    expect(endpoints(ana)).toEqual([]);
  });

  it("forgets an endpoint the push service says is gone, and notes deliveries", () => {
    const ana = addUser("ana");
    store.save(ana, sub(1));
    store.save(ana, sub(2));
    store.markDelivered(sub(2).endpoint);
    store.forget(sub(1).endpoint);
    expect(store.list(ana)).toEqual([{ ...sub(2), createdAt: "2026-10-27T10:00:02.000Z", lastSuccessAt: "2026-10-27T10:00:03.000Z" }]);
  });

  it("lists every user with a subscription, once", () => {
    const ana = addUser("ana");
    const ion = addUser("ion");
    addUser("eva");
    store.save(ion, sub(1));
    store.save(ana, sub(2));
    store.save(ana, sub(3));
    expect(store.userIds()).toEqual([ana, ion]);
  });

  it("goes with the user", () => {
    const ana = addUser("ana");
    store.save(ana, sub(1));
    db.prepare("DELETE FROM auth_users WHERE id = ?").run(ana);
    expect(db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get()).toEqual({ n: 0 });
  });
});
