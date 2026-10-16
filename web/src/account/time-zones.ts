import { isIanaZone } from "@almanac/shared";

/**
 * The time zone picker's data (corpus/wiki/features.md "Account menu"): every
 * zone the browser knows, each with its offset at a given moment and the
 * city, and the search over them. Pure and given `at` instead of reading the
 * clock, so a test can ask about January and July.
 *
 * A zone is stored under the name the browser lists it by, never mapped to
 * another (`Europe/Kyiv` stays `Europe/Kyiv`).
 */

export interface ZoneEntry {
  /** The IANA name as listed: "Europe/Bucharest". */
  zone: string;
  /** "Bucharest"; "Buenos Aires" for "America/Argentina/Buenos_Aires". */
  city: string;
  /** Minutes east of UTC at the moment asked about: 180. */
  offsetMinutes: number;
  /** "+03:00". */
  offset: string;
  /** What the list shows: "(GMT+03:00) Bucharest". */
  label: string;
  /** What the search looks in: name, city and offset, lower-cased and without accents. */
  searchText: string;
}

/** "+03:00", "-05:30", "+00:00". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const total = Math.abs(minutes);
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const rest = String(total % 60).padStart(2, "0");
  return `${sign}${hours}:${rest}`;
}

/** "Europe/Bucharest" → "Bucharest"; "America/Argentina/Buenos_Aires" → "Buenos Aires"; "UTC" → "UTC". */
export function cityOf(zone: string): string {
  return (zone.split("/").at(-1) ?? zone).replaceAll("_", " ");
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(zone, formatter);
  }
  return formatter;
}

/**
 * Minutes east of UTC that `zone` is at `at` (an instant: a `Date` or epoch
 * ms): the wall clock there read as if it were UTC, less the instant itself.
 * Throws a `RangeError` for a name the browser doesn't know.
 */
export function offsetMinutesAt(zone: string, at: Date | number): number {
  const ms = Math.floor((at instanceof Date ? at.getTime() : at) / 1000) * 1000;
  const parts: Record<string, number> = {};
  for (const part of formatterFor(zone).formatToParts(ms)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const wall = Date.UTC(parts.year ?? 1970, (parts.month ?? 1) - 1, parts.day ?? 1, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0);
  return Math.round((wall - ms) / 60_000);
}

/** Lower-case, without accents, underscores as spaces: what the search compares. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replaceAll("_", " ").toLowerCase().trim();
}

/** One zone as the picker shows it at `at`. */
export function zoneEntry(zone: string, at: Date | number): ZoneEntry {
  const offsetMinutes = offsetMinutesAt(zone, at);
  const offset = formatOffset(offsetMinutes);
  const city = cityOf(zone);
  return {
    zone,
    city,
    offsetMinutes,
    offset,
    label: `(GMT${offset}) ${city}`,
    searchText: normalize(`${zone} ${city} gmt${offset}`),
  };
}

/** "(GMT+03:00) Bucharest". */
export function zoneLabel(zone: string, at: Date | number): string {
  return zoneEntry(zone, at).label;
}

/**
 * The names the browser lists, plus "UTC" (which `Intl.supportedValuesOf`
 * leaves out), as the server would accept them.
 */
export function supportedZones(): string[] {
  const listed = "supportedValuesOf" in Intl ? Intl.supportedValuesOf("timeZone") : [];
  const names = listed.includes("UTC") ? listed : [...listed, "UTC"];
  return names.filter(isIanaZone);
}

/** Every zone at `at`, from the west to the east, then by city: the order Google's list has. */
export function listTimeZones(at: Date | number): ZoneEntry[] {
  return supportedZones()
    .map((zone) => zoneEntry(zone, at))
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city, "en") || a.zone.localeCompare(b.zone, "en"));
}

/** An offset typed in the search: "+03:00", "gmt+3", "utc-5", "+5:30", "+0530". */
const OFFSET_TOKEN = /^(?:gmt|utc)?([+-])(\d{1,2}):?(\d{2})?$/;

function matchesToken(entry: ZoneEntry, token: string): boolean {
  const asOffset = OFFSET_TOKEN.exec(token);
  if (asOffset === null) return entry.searchText.includes(token);
  const sign = asOffset[1] === "-" ? -1 : 1;
  const hours = Number(asOffset[2]);
  // Hours alone ("+3") take every offset in that hour (+03:00, +03:30); with minutes it is exact.
  if (asOffset[3] === undefined) return Math.trunc(entry.offsetMinutes / 60) === sign * hours;
  return entry.offsetMinutes === sign * (hours * 60 + Number(asOffset[3]));
}

/**
 * Whether `entry` answers the search: every word of `query` must match its
 * city, its name (the region is in it) or its offset, ignoring case and
 * accents. An empty search matches everything.
 */
export function matchesZone(entry: ZoneEntry, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  return tokens.every((token) => matchesToken(entry, token));
}
