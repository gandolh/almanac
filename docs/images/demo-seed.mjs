// Demo data for the README images. Run it against a SCRATCH database only,
// never against data/ in a checkout you use:
//
//   ALMANAC_USER=demo ALMANAC_PASSWORD=... node docs/images/demo-seed.mjs [api]
//
// Start the server with DATA_DIR pointing at a scratch folder, create the user
// there first (`npm run seed -w @almanac/server`), then run this. [api] is the
// API without the browser prefix, http://127.0.0.1:8809 by default. Everything
// goes through the same /api routes the app uses.
//
// It adds three calendars to the user's "Personal" one, a few repeating
// events, made-up birthdays across the year and one-off events around the
// current week, so the month, week and year views look lived-in on any day
// you run it. Times are wall-clock times in the display zone, Europe/Bucharest.
// To start over, stop the server and delete the scratch folder.
/* global process, console, fetch */

const api = process.argv[2] ?? "http://127.0.0.1:8809";
const { ALMANAC_USER: username, ALMANAC_PASSWORD: password } = process.env;
if (!username || !password) {
  console.error("Set ALMANAC_USER and ALMANAC_PASSWORD to the scratch user's sign-in.");
  process.exit(1);
}
const ZONE = "Europe/Bucharest";

const login = await fetch(`${api}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
if (!login.ok) throw new Error(`Sign-in failed: ${login.status}`);
const cookie = login.headers.get("set-cookie").split(";")[0];

async function call(method, path, body) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}

// --- dates -----------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Today in the display zone, as a UTC-midnight Date used only for its fields.
const [ty, tm, td] = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date()).split("-").map(Number);
const today = new Date(Date.UTC(ty, tm - 1, td));
// Monday of the current week; every one-off below is placed from here.
const monday = new Date(today);
monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));

/** The day `days` after this week's Monday. */
function day(days) {
  const d = new Date(monday);
  d.setUTCDate(monday.getUTCDate() + days);
  return d;
}

/** The zone's offset from UTC at an instant, in minutes. */
function offsetAt(ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, Number(p.value)]),
  );
  return (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - ms) / 60000;
}

/** A wall-clock time on a day, in the display zone, as an instant. */
function at(d, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const wall = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m);
  let ms = wall - offsetAt(wall) * 60000;
  ms = wall - offsetAt(ms) * 60000;
  return new Date(ms).toISOString();
}

const nextDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
const plusDays = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

// --- calendars ---------------------------------------------------------------

const { calendars } = await call("GET", "/api/calendars");
const personal = calendars.find((c) => c.name === "Personal") ?? calendars[0];
const work = await call("POST", "/api/calendars", { name: "Work", color: "orange" });
const sport = await call("POST", "/api/calendars", { name: "Sport", color: "green" });
const birthdays = await call("POST", "/api/calendars", { name: "Birthdays", color: "pink" });
const id = (c) => c.id ?? c.calendar?.id;

let count = 0;
async function timed(calendar, title, d, from, to, extra = {}) {
  await call("POST", "/api/events", {
    calendarId: id(calendar),
    title,
    allDay: false,
    start: at(d, from),
    end: at(d, to),
    location: "",
    notes: "",
    ...extra,
  });
  count++;
}
async function allDay(calendar, title, d, days = 1, extra = {}) {
  await call("POST", "/api/events", {
    calendarId: id(calendar),
    title,
    allDay: true,
    start: ymd(d),
    end: ymd(plusDays(d, days)),
    location: "",
    notes: "",
    ...extra,
  });
  count++;
}

// --- repeating events ----------------------------------------------------------

const never = { type: "never" };
await timed(work, "Team stand-up", day(-35), "09:30", "09:45", {
  location: "Room 2",
  repeat: { freq: "weekly", byDay: ["MO", "WE", "FR"], end: never },
});
await timed(sport, "Swimming", day(-34), "18:30", "19:30", {
  location: "City pool",
  repeat: { freq: "weekly", byDay: ["TU", "TH"], end: never },
});
await timed(personal, "Piano lesson", day(-30), "10:00", "11:00", {
  repeat: { freq: "weekly", end: { type: "count", count: 12 } },
});
await allDay(personal, "Pay rent", new Date(Date.UTC(ty, 0, 5)), 1, {
  repeat: { freq: "monthly", end: never },
});

// Birthdays spread over the year, so the year view has dots in every season.
for (const [title, month, date] of [
  ["Ana's birthday", 1, 12],
  ["Theo's birthday", 4, 3],
  ["Maya's birthday", 7, 21],
  ["Sam's birthday", 11, 2],
]) {
  await allDay(birthdays, title, new Date(Date.UTC(ty - 1, month, date)), 1, {
    repeat: { freq: "yearly", end: never },
  });
}

// --- one-offs earlier in the year ------------------------------------------------

for (const month of [0, 3, 6]) {
  const d = new Date(Date.UTC(ty, month, 14));
  if (d < monday) await timed(work, "Quarterly planning", d, "10:00", "12:00");
}
const holiday = new Date(Date.UTC(ty, 6, 6));
if (holiday < monday) await allDay(personal, "Holiday by the sea", holiday, 8, { location: "Sample Bay" });
const race = new Date(Date.UTC(ty, 4, 17));
if (race < monday) await timed(sport, "10 km fun run", race, "08:00", "10:00");

// --- around the current week -----------------------------------------------------

await timed(work, "Design review", day(-14), "14:00", "15:00");
await timed(personal, "Dentist", day(-12), "08:00", "08:45", { location: "Sample Dental Clinic" });
await allDay(sport, "Hike, north trail", day(-9));
await timed(work, "Quarterly planning", day(-6), "10:00", "12:00", { location: "Room 4" });
await timed(personal, "Book club", day(-4), "19:00", "21:00", { notes: "This month: a short novel, chapters 1-9." });
await timed(personal, "Lunch with Maya", day(-3), "13:00", "14:00");

await timed(work, "1:1 with Theo", day(0), "11:00", "11:30");
await timed(work, "Product demo", day(2), "15:00", "16:00", { location: "Room 4" });
await timed(work, "Write the release notes", day(3), "13:30", "15:00");
await timed(personal, "Haircut", day(4), "17:00", "17:30");
await timed(personal, "Farmers' market", day(5), "09:00", "10:30");
await timed(personal, "Call home", day(6), "18:00", "18:30");

await allDay(work, "Conference", day(7), 3, { location: "Sample City" });
await timed(personal, "Car service", day(10), "08:30", "09:30", { location: "Sample Garage" });
await timed(personal, "Concert", day(12), "20:00", "22:30", { location: "Old Town Hall" });
await timed(work, "Design review", day(15), "14:00", "15:00");
await timed(work, "Team dinner", day(18), "19:30", "22:00");
await timed(sport, "Climbing", day(20), "16:00", "18:00");
await timed(personal, "Flight home", day(24), "06:40", "09:10", { location: "Terminal 1" });
await allDay(personal, "Public holiday", nextDay(day(29)));

console.log(`Seeded 3 calendars and ${count} events for the week of ${ymd(monday)}.`);
