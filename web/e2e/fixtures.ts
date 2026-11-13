import { test as base, expect, type Page, type Route } from "@playwright/test";

/**
 * The browser tests' world: Wednesday 11 November 2026, 10:30 in Bucharest, and
 * the week of 9 to 15 November as the redesign board drew it (four calendars,
 * fifteen events in that week). The API is answered here, from this data, so
 * a run needs no server, database or account, and the week never goes stale.
 */

/** 10:30 in Bucharest (UTC+2). */
export const NOW = "2026-11-11T08:30:00Z";

const API = "**/almanac-api/**";

type CalendarColor = "blue" | "green" | "orange" | "purple";
interface FixtureCalendar {
  id: number;
  name: string;
  color: CalendarColor;
}

export const CALENDARS: readonly FixtureCalendar[] = [
  { id: 1, name: "Personal", color: "blue" },
  { id: 2, name: "Work", color: "green" },
  { id: 3, name: "Home", color: "orange" },
  { id: 4, name: "Fitness", color: "purple" },
];

interface FixtureEvent {
  id: number;
  calendarId: number;
  title: string;
  /** `YYYY-MM-DD` in the display zone. */
  day: string;
  /** `HH:MM`, or null for all day. */
  from: string | null;
  to: string | null;
  location?: string;
  notes?: string;
  reminderMinutes?: number | null;
  /** A repeating series this belongs to. */
  seriesId?: number;
}

const DAYS = [
  "2026-11-09",
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
  "2026-11-15",
] as const;
const [MON, TUE, WED, THU, FRI, SAT, SUN] = DAYS;

const STANDUP = { calendarId: 2, title: "Team standup", from: "09:30", to: "10:00", seriesId: 1 } as const;
const RUN = { calendarId: 4, title: "Run", from: "07:00", to: "07:45", seriesId: 2 } as const;

/** The fifteen events of the week, from the board's content fixture (directions/almanac.md, section 3). */
export const EVENTS: readonly FixtureEvent[] = [
  { id: 1, ...STANDUP, day: MON },
  { id: 2, calendarId: 2, title: "Planning", day: MON, from: "14:00", to: "15:30" },
  { id: 3, calendarId: 3, title: "Dentist", day: TUE, from: "08:30", to: "09:30" },
  { id: 4, ...STANDUP, day: TUE },
  { id: 5, ...RUN, day: WED },
  { id: 6, ...STANDUP, day: WED },
  {
    id: 7,
    calendarId: 2,
    title: "Design review",
    day: WED,
    from: "11:00",
    to: "12:00",
    location: "Room 2",
    notes: "Walk through the new layout and collect comments.",
    reminderMinutes: 15,
  },
  { id: 8, calendarId: 3, title: "Groceries", day: WED, from: "17:30", to: "18:15" },
  { id: 9, calendarId: 1, title: "Read", day: WED, from: "20:00", to: "21:00" },
  { id: 10, calendarId: 3, title: "Anniversary", day: THU, from: null, to: null },
  { id: 11, ...STANDUP, day: THU },
  { id: 12, calendarId: 2, title: "Release check", day: THU, from: "15:00", to: "16:00" },
  { id: 13, ...RUN, day: FRI },
  { id: 14, ...STANDUP, day: FRI },
  { id: 15, calendarId: 2, title: "One to one", day: FRI, from: "10:00", to: "10:45" },
  { id: 16, calendarId: 3, title: "Dinner with Alex", day: FRI, from: "19:00", to: "21:00", location: "Corner bistro" },
  { id: 17, calendarId: 4, title: "Yoga", day: SAT, from: "10:00", to: "11:00" },
  { id: 18, calendarId: 1, title: "Call home", day: SUN, from: "18:00", to: "18:30" },
];

/** A wall-clock time in Bucharest (UTC+2 on these days) as the wire's instant. */
function instant(day: string, time: string): string {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const utc = new Date(`${day}T00:00:00Z`);
  utc.setUTCHours(hour - 2, minute);
  return utc.toISOString().replace(".000Z", "Z");
}

function occurrenceOf(event: FixtureEvent) {
  const allDay = event.from === null;
  const next = new Date(`${event.day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const start = allDay ? event.day : instant(event.day, event.from ?? "00:00");
  const end = allDay ? next.toISOString().slice(0, 10) : instant(event.day, event.to ?? "00:00");
  const repeat =
    event.seriesId === 1
      ? { freq: "weekly", byDay: ["MO", "TU", "WE", "TH", "FR"], end: { type: "never" } }
      : event.seriesId === 2
        ? { freq: "weekly", byDay: ["MO", "WE", "FR"], end: { type: "never" } }
        : null;
  return {
    id: `e${event.id}`,
    eventId: event.seriesId ?? event.id,
    seriesId: event.seriesId ?? null,
    originalStart: event.seriesId ? start : null,
    calendarId: event.calendarId,
    title: event.title,
    location: event.location ?? "",
    notes: event.notes ?? "",
    allDay,
    start,
    end,
    repeat,
    reminderMinutes: event.reminderMinutes ?? null,
  };
}

const OCCURRENCES = EVENTS.map(occurrenceOf);

const NOW_ISO = "2026-11-11T08:30:00.000Z";

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** The comparable instant of a wire value: an instant, or a date taken as midnight in Bucharest. */
function when(value: string): number {
  return value.length === 10 ? Date.parse(`${value}T00:00:00+02:00`) : Date.parse(value);
}

export interface StubOptions {
  /** Answer the session question as signed out (the sign-in screen). */
  signedOut?: boolean;
  /** The calendars' answer fails, for the error states. */
  calendarsFail?: boolean;
  /** Occurrences come back empty, for the empty week. */
  empty?: boolean;
  /** The occurrences request never answers, for the loading state. */
  slow?: boolean;
}

/** The links the stubbed calendar feed hands out, one per "New link", in turn. */
export const FEED_TOKENS = ["A", "B", "C", "D"].map((letter) => letter.repeat(43));

/**
 * Answers every API call from the fixture; writes are accepted and change nothing, but for the
 * calendar feed, whose state (on, off, which link) lives as long as the page.
 */
export async function stubApi(page: Page, options: StubOptions = {}): Promise<void> {
  const feed = { on: false, made: 0 };
  await page.route(API, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/almanac-api/, "");
    if (path === "/api/feed") {
      if (request.method() === "POST") {
        const token = FEED_TOKENS[feed.made % FEED_TOKENS.length] ?? "";
        feed.on = true;
        feed.made++;
        return json(route, { url: `${url.origin}/almanac-api/api/feed/${token}/almanac.ics`, createdAt: NOW_ISO }, 201);
      }
      if (request.method() === "DELETE") {
        feed.on = false;
        return route.fulfill({ status: 204 });
      }
      return json(route, { on: feed.on, createdAt: feed.on ? NOW_ISO : null });
    }
    if (path === "/auth/session") {
      return options.signedOut
        ? json(route, { user: null, session: null, ward: { enabled: false, linked: false } })
        : json(route, {
            user: { id: "u1", username: "tess", role: "user", hasPassword: true },
            session: { origin: "local", expiresAt: Date.parse(NOW_ISO) + 7 * 24 * 3_600_000 },
            ward: { enabled: false, linked: false },
          });
    }
    if (path === "/api/settings") return json(route, { timeZone: "Europe/Bucharest" });
    if (path === "/api/calendars" && request.method() === "GET") {
      if (options.calendarsFail) return json(route, { error: "internal" }, 500);
      return json(route, {
        calendars: CALENDARS.map((calendar, position) => ({
          ...calendar,
          visible: true,
          position,
          createdAt: "2026-10-01T08:00:00Z",
          updatedAt: "2026-10-01T08:00:00Z",
        })),
      });
    }
    if (path === "/api/occurrences") {
      if (options.slow) return new Promise<void>(() => undefined);
      const from = when(url.searchParams.get("from") ?? "");
      const to = when(url.searchParams.get("to") ?? "");
      const found = options.empty
        ? []
        : OCCURRENCES.filter((occurrence) => when(occurrence.start) < to && when(occurrence.end) > from);
      return json(route, { occurrences: found });
    }
    if (path === "/api/search") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const found = OCCURRENCES.filter((occurrence) =>
        `${occurrence.title} ${occurrence.location} ${occurrence.notes}`.toLowerCase().includes(q),
      );
      return json(route, { results: found, occurrences: found });
    }
    if (request.method() === "GET") return json(route, { error: "not_found" }, 404);
    return route.fulfill({ status: 204 });
  });
}

/**
 * Freezes the clock at `NOW`. Chromium's own Temporal ignores a fake clock, so the page's
 * `Temporal.Now.instant` is made to read it, which the app's "today" and "now" come from.
 */
export async function freezeClock(page: Page): Promise<void> {
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript(() => {
    const native = (
      globalThis as { Temporal?: { Now: object; Instant: { fromEpochMilliseconds(ms: number): unknown } } }
    ).Temporal;
    if (!native) return;
    Object.defineProperty(native.Now, "instant", {
      configurable: true,
      writable: true,
      value: () => native.Instant.fromEpochMilliseconds(Date.now()),
    });
  });
}

/** The theme this project tests: what the app stores under its theme key before the first paint. */
export async function chooseTheme(page: Page, theme: string): Promise<void> {
  await page.addInitScript((choice) => window.localStorage.setItem("almanac.theme", choice), theme);
}

export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use, testInfo) => {
    await freezeClock(page);
    await chooseTheme(page, String(testInfo.project.metadata.theme));
    await stubApi(page);
    await use(page);
  },
});

export { expect };

/** The screens the specs walk: where each opens, and a name. */
export const SCREENS = [
  { name: "week", path: "week/2026/11/11" },
  { name: "day", path: "day/2026/11/11" },
  { name: "month", path: "month/2026/11/11" },
  { name: "year", path: "year/2026/11/11" },
  { name: "search", path: "search?q=team" },
] as const;
