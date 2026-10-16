import { useSyncExternalStore } from "react";
import { ApiError } from "../api";

/**
 * The data layer's two small pieces, for `useSyncExternalStore`:
 *
 * - `createStore`: one value, its listeners, and nothing else;
 * - `createResource`: a value the app fetches once per session (the
 *   calendars, the settings), with its loading state. Every change made
 *   through the app is applied to it in place, so every view re-renders
 *   without a refetch; `refresh` fetches again on purpose.
 */

export interface Store<T> {
  getState(): T;
  /** A new value, or an update of the current one. Listeners hear about it only when it changed. */
  setState(next: T | ((current: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState(next) {
      const value = typeof next === "function" ? (next as (current: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** A store's value; re-renders when it changes. Renders on the server too (tests), with the current value. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

// --- A value fetched once per session ---------------------------------------------------

/**
 * - `loading`: no value yet (the first fetch, or a retry after it failed);
 * - `ready`: `value` is the server's. A refresh that fails keeps it and sets `error`;
 * - `error`: the first fetch failed; `error` says why, and `refresh` retries.
 */
export type LoadStatus = "loading" | "ready" | "error";

export interface ResourceState<T> {
  readonly value: T;
  readonly status: LoadStatus;
  readonly error: ApiError | null;
}

export interface Resource<T> {
  readonly store: Store<ResourceState<T>>;
  /** Fetch unless this session already has (or is fetching). */
  ensureLoaded(): void;
  /** Fetch again; concurrent calls share one request. Never rejects: a failure lands in `error`. */
  refresh(): Promise<void>;
  /** Change the value in place (a write the server confirmed, or an optimistic one), replayed onto a fetch in flight. */
  apply(update: (value: T) => T): void;
  /** Forget it (signed out): the next `ensureLoaded` fetches afresh. */
  reset(): void;
}

export function createResource<T>(load: () => Promise<T>, initial: T, failure: string): Resource<T> {
  const fresh: ResourceState<T> = { value: initial, status: "loading", error: null };
  const store = createStore(fresh);
  let loaded = false; // a fetch has succeeded since the last reset
  let started = false;
  let inFlight: Promise<void> | null = null;
  // Changes made while a fetch is in flight, replayed onto its answer: the
  // server may have read the value before the change landed.
  let pending: ((value: T) => T)[] = [];
  // Bumped by `reset`, so the answer to a fetch from before it is dropped.
  let generation = 0;

  const set = (next: Partial<ResourceState<T>>) => store.setState((state) => ({ ...state, ...next }));

  function refresh(): Promise<void> {
    if (inFlight) return inFlight;
    started = true;
    pending = [];
    const run = generation;
    const now = store.getState();
    if (!loaded && (now.status !== "loading" || now.error !== null)) set({ status: "loading", error: null });
    const request = load().then(
      (value) => {
        if (run !== generation) return;
        loaded = true;
        set({ value: pending.reduce((current, update) => update(current), value), status: "ready", error: null });
      },
      (error: unknown) => {
        if (run !== generation) return;
        set({ status: loaded ? "ready" : "error", error: toApiError(error, failure) });
      },
    );
    const tracked: Promise<void> = request.finally(() => {
      if (inFlight !== tracked) return; // a reset already let go of it
      inFlight = null;
      pending = [];
    });
    inFlight = tracked;
    return tracked;
  }

  return {
    store,
    ensureLoaded() {
      if (!started) void refresh();
    },
    refresh,
    apply(update) {
      if (inFlight) pending.push(update);
      set({ value: update(store.getState().value) });
    },
    reset() {
      generation += 1;
      loaded = false;
      started = false;
      inFlight = null;
      pending = [];
      store.setState(fresh);
    },
  };
}

export function toApiError(error: unknown, message: string): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, "bad_response", message, { cause: error });
}

// --- One session's data ------------------------------------------------------------------

/** What `resetWhenSignedOut` reads of the session; the vendored auth client fits. */
export interface SessionSource {
  getState(): { status: string };
  subscribe(listener: () => void): () => void;
}

/**
 * The data belongs to a session: forget it when the session turns signed
 * out, so the next user fetches their own. On the session's word rather than
 * on any 401: a 401 makes session.ts ask the server again, and when the
 * answer is still "signed in" the shell stays mounted and nothing would
 * fetch again. Returns the unsubscribe function.
 */
export function resetWhenSignedOut(reset: () => void, session: SessionSource): () => void {
  let previous = session.getState().status;
  return session.subscribe(() => {
    const status = session.getState().status;
    if (status === "signed_out" && previous !== "signed_out") reset();
    previous = status;
  });
}
