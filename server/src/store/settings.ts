import { DEFAULT_TIME_ZONE, type Settings, type SettingsPatch } from "@almanac/shared";
import type { Db } from "../db/open.js";

/**
 * The settings store: the only module that runs SQL on `user_settings`. A
 * user has a row only once they change something; until then every setting
 * is its default.
 */
export interface SettingsStore {
  /** The user's settings, the defaults where they have no row. */
  get(userId: string): Settings;
  /** Changes what is given and keeps the rest. Answers the settings as they now are. */
  set(userId: string, patch: SettingsPatch): Settings;
}

export function createSettingsStore(db: Db): SettingsStore {
  const getRow = db.prepare<[string], Settings>("SELECT time_zone AS timeZone FROM user_settings WHERE user_id = ?");
  const upsert = db.prepare<[string, string]>(`
    INSERT INTO user_settings (user_id, time_zone) VALUES (?, ?)
    ON CONFLICT (user_id) DO UPDATE SET time_zone = excluded.time_zone`);

  const get = (userId: string): Settings => getRow.get(userId) ?? { timeZone: DEFAULT_TIME_ZONE };

  return {
    get,
    set(userId, patch) {
      if (patch.timeZone !== undefined) upsert.run(userId, patch.timeZone);
      return get(userId);
    },
  };
}
