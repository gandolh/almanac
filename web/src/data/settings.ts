import { DEFAULT_TIME_ZONE, settingsSchema, type Settings, type SettingsPatch } from "@almanac/shared";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { Temporal } from "temporal-polyfill";
import { apiRequest, type ApiError } from "../api";
import { authClient } from "../auth/session";
import { todayIn } from "../dates";
import { createResource, resetWhenSignedOut, useStore, type LoadStatus } from "./store";

/**
 * The user's settings (brief 03's `/api/settings`): v1 has one, the display
 * time zone. Until the first answer, and if it fails, the zone is
 * `DEFAULT_TIME_ZONE` (Europe/Bucharest), so nothing waits on it; the shell
 * holds only its `/` redirect until the answer is in. A change is saved
 * first and shown when the server confirms it.
 */

export interface SettingsSource {
  get(): Promise<Settings>;
  patch(patch: SettingsPatch): Promise<Settings>;
}

export const settingsApi: SettingsSource = {
  get: () => apiRequest("/api/settings", { schema: settingsSchema }),
  patch: (patch) => apiRequest("/api/settings", { method: "PATCH", body: patch, schema: settingsSchema }),
};

export function createSettingsStore(source: SettingsSource) {
  const resource = createResource<Settings>(source.get, { timeZone: DEFAULT_TIME_ZONE }, "Your settings couldn't be loaded.");
  return {
    resource,
    /** `PATCH /api/settings`; every view follows once the server has it. Rejects with an `ApiError`. */
    async setTimeZone(timeZone: string): Promise<void> {
      const settings = await source.patch({ timeZone });
      resource.apply(() => settings);
    },
  };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;

// --- The app's store ---------------------------------------------------------------

const settingsStore = createSettingsStore(settingsApi);

resetWhenSignedOut(settingsStore.resource.reset, authClient());

export interface SettingsView {
  /** The display time zone, an IANA name; `DEFAULT_TIME_ZONE` until loaded. */
  readonly timeZone: string;
  readonly status: LoadStatus;
  readonly error: ApiError | null;
  setTimeZone(timeZone: string): Promise<void>;
  refresh(): Promise<void>;
}

const actions = { setTimeZone: settingsStore.setTimeZone, refresh: settingsStore.resource.refresh };

/** The settings, loaded on first use. Re-renders when they change. */
export function useSettings(): SettingsView {
  const state = useStore(settingsStore.resource.store);
  useEffect(() => settingsStore.resource.ensureLoaded(), []);
  return useMemo(() => ({ timeZone: state.value.timeZone, status: state.status, error: state.error, ...actions }), [state]);
}

/** The display time zone as it is now, outside a component. */
export function currentTimeZone(): string {
  return settingsStore.resource.store.getState().value.timeZone;
}

// --- Today --------------------------------------------------------------------------

/** How often the clock is looked at for a new day; also when the tab comes back into view. */
const TICK_MS = 30_000;

function subscribeClock(onChange: () => void): () => void {
  const timer = setInterval(onChange, TICK_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Today in the display time zone; re-renders when the date there changes (midnight, a new zone). */
export function useToday(): Temporal.PlainDate {
  const { timeZone } = useSettings();
  const read = useCallback(() => todayIn(timeZone).toString(), [timeZone]);
  const key = useSyncExternalStore(subscribeClock, read, read);
  return useMemo(() => Temporal.PlainDate.from(key), [key]);
}
