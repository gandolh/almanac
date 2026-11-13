import { Temporal } from "temporal-polyfill";

/**
 * A `VTIMEZONE` for an IANA zone, from the runtime's own zone data (Temporal's
 * transitions), so the feed never carries a table of its own to go stale.
 *
 * RFC 5545 wants one for every `TZID` a feed uses. Calendar apps that know the
 * IANA name (Android's, Google's, Apple's, Thunderbird's) use their own data
 * for it; this is for the rest, and for validators. The shape is the one
 * Google Calendar exports: the zone's current rules as a yearly `RRULE` per
 * change ("the last Sunday of March at 03:00"), started in 1970.
 *
 * The rules are read from `year`'s transitions and checked against the next
 * few years. A zone whose changes follow no weekday rule (one that moves with
 * a lunar calendar) gets its transitions listed one by one instead, from the
 * year before `year` to ten years after. A zone without summer time gets one
 * `STANDARD` observance.
 */

/** How many years after `year` a derived rule must predict before it is trusted. */
const YEARS_CHECKED = 4;

/** How far the listed transitions reach, for a zone without a weekday rule. */
const YEARS_LISTED_BEFORE = 1;
const YEARS_LISTED_AFTER = 10;

const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

/** One change of offset, as an observance needs it. */
interface Change {
  /** `DAYLIGHT` when the offset grows, `STANDARD` when it shrinks. */
  kind: "DAYLIGHT" | "STANDARD";
  /** The wall-clock time the change happens at, read in the offset before it. */
  at: Temporal.PlainDateTime;
  from: number;
  to: number;
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

/** `19700329T030000`: a wall-clock time with no zone. */
export function formatLocal(at: Temporal.PlainDateTime): string {
  return `${pad(at.year, 4)}${pad(at.month)}${pad(at.day)}T${pad(at.hour)}${pad(at.minute)}${pad(at.second)}`;
}

/** An offset in nanoseconds as `+0200`, with seconds only when it has them. */
export function formatOffset(nanoseconds: number): string {
  const total = Math.round(nanoseconds / 1e9);
  const sign = total < 0 ? "-" : "+";
  const abs = Math.abs(total);
  const seconds = abs % 60;
  return `${sign}${pad(Math.floor(abs / 3600))}${pad(Math.floor(abs / 60) % 60)}${seconds === 0 ? "" : pad(seconds)}`;
}

/** The changes of offset in the zone during `year` (by the zone's own calendar), in order. */
function changesIn(tzid: string, year: number): Change[] {
  let at = Temporal.ZonedDateTime.from({ year, month: 1, day: 1, timeZone: tzid });
  const end = at.add({ years: 1 });
  const changes: Change[] = [];
  for (;;) {
    const next = at.getTimeZoneTransition("next");
    if (next === null || Temporal.ZonedDateTime.compare(next, end) >= 0) return changes;
    const from = next.subtract({ nanoseconds: 1 }).offsetNanoseconds;
    const to = next.offsetNanoseconds;
    if (from !== to) {
      changes.push({
        kind: to > from ? "DAYLIGHT" : "STANDARD",
        at: next.toInstant().add({ nanoseconds: from }).toZonedDateTimeISO("UTC").toPlainDateTime(),
        from,
        to,
      });
    }
    at = next;
  }
}

/** A yearly rule for a change: its month and its weekday counted from the start of the month, or `-1` for the last. */
interface YearlyRule {
  month: number;
  week: number;
  weekday: (typeof WEEKDAYS)[number];
}

function ruleOf(change: Change): YearlyRule {
  const { at } = change;
  const last = at.day + 7 > at.daysInMonth;
  return { month: at.month, week: last ? -1 : Math.ceil(at.day / 7), weekday: WEEKDAYS[at.dayOfWeek - 1] ?? "SU" };
}

/** The date the rule falls on in `year`. */
function dateOf(rule: YearlyRule, year: number): Temporal.PlainDate {
  const weekday = WEEKDAYS.indexOf(rule.weekday) + 1;
  if (rule.week === -1) {
    const lastDay = Temporal.PlainDate.from({ year, month: rule.month, day: 1 })
      .add({ months: 1 })
      .subtract({ days: 1 });
    return lastDay.subtract({ days: (lastDay.dayOfWeek - weekday + 7) % 7 });
  }
  const first = Temporal.PlainDate.from({ year, month: rule.month, day: 1 });
  return first.add({ days: ((weekday - first.dayOfWeek + 7) % 7) + 7 * (rule.week - 1) });
}

/** Whether `rules` (one per change in the reference year) give exactly `year`'s changes. */
function predicts(rules: readonly YearlyRule[], reference: readonly Change[], actual: readonly Change[]): boolean {
  if (actual.length !== reference.length) return false;
  return actual.every((change, index) => {
    const rule = rules[index];
    const model = reference[index];
    if (rule === undefined || model === undefined) return false;
    return (
      change.from === model.from &&
      change.to === model.to &&
      change.at.toPlainDate().equals(dateOf(rule, change.at.year)) &&
      change.at.toPlainTime().equals(model.at.toPlainTime())
    );
  });
}

/** The observance lines for a change, without `BEGIN` and `END`. */
function offsets(change: Pick<Change, "from" | "to">): string[] {
  return [`TZOFFSETFROM:${formatOffset(change.from)}`, `TZOFFSETTO:${formatOffset(change.to)}`];
}

/** The `VTIMEZONE` for `tzid`, as unfolded content lines, its rules read from `year`. */
export function vtimezoneLines(tzid: string, year: number): string[] {
  const lines = ["BEGIN:VTIMEZONE", `TZID:${tzid}`, `X-LIC-LOCATION:${tzid}`];
  const reference = changesIn(tzid, year);

  if (reference.length === 0) {
    const offset = Temporal.ZonedDateTime.from({ year, month: 1, day: 1, timeZone: tzid }).offsetNanoseconds;
    lines.push(
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      ...offsets({ from: offset, to: offset }),
      "END:STANDARD",
      "END:VTIMEZONE",
    );
    return lines;
  }

  const rules = reference.map(ruleOf);
  const ruled = Array.from({ length: YEARS_CHECKED }, (_, i) => year + 1 + i).every((later) =>
    predicts(rules, reference, changesIn(tzid, later)),
  );

  if (ruled) {
    reference.forEach((change, index) => {
      const rule = rules[index];
      if (rule === undefined) return;
      const first = dateOf(rule, 1970).toPlainDateTime(change.at.toPlainTime());
      lines.push(
        `BEGIN:${change.kind}`,
        `DTSTART:${formatLocal(first)}`,
        `RRULE:FREQ=YEARLY;BYMONTH=${rule.month};BYDAY=${rule.week}${rule.weekday}`,
        ...offsets(change),
        `END:${change.kind}`,
      );
    });
  } else {
    // Each change on its own: no rule would reproduce them.
    const listed: Change[] = [];
    for (let y = year - YEARS_LISTED_BEFORE; y <= year + YEARS_LISTED_AFTER; y++) listed.push(...changesIn(tzid, y));
    const first = listed[0];
    if (first !== undefined) {
      // What held before the first listed change, so times before it have an offset too.
      lines.push(
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        ...offsets({ from: first.from, to: first.from }),
        "END:STANDARD",
      );
    }
    for (const change of listed) {
      lines.push(`BEGIN:${change.kind}`, `DTSTART:${formatLocal(change.at)}`, ...offsets(change), `END:${change.kind}`);
    }
  }
  lines.push("END:VTIMEZONE");
  return lines;
}
