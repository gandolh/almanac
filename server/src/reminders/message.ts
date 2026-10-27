import { addDays, occurrenceDate, parseInstant, dateInZone, type Occurrence, type PushPayload } from "@almanac/shared";

/**
 * What a reminder says (brief 16): the event's title and when, judged from
 * the moment it is due in the user's display time zone. "Dentist, 14:30",
 * "Dentist, tomorrow at 09:00", "Name day, today", "Name day, tomorrow".
 * The location, if any, is the body. Pressing it opens the event's day.
 */

/** "14:30" in `timeZone`, on the 24-hour clock the app uses. */
function clock(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
}

/** "today", "tomorrow", or "on 16 Oct" for anything further (no reminder offered reaches that far today). */
function dayWord(date: string, from: string): string {
  if (date === from) return "today";
  if (date === addDays(from, 1)) return "tomorrow";
  const [, month, day] = date.split("-").map(Number);
  const name = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(Date.UTC(2000, (month ?? 1) - 1, 1));
  return `on ${day} ${name}`;
}

/** The web app's day view for a date: `/almanac/day/2026/10/27`, unpadded, as the router writes it. */
export function dayPath(webBase: string, date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${webBase}day/${year}/${month}/${day}`;
}

export function reminderPayload(occurrence: Occurrence, dueAt: number, timeZone: string, webBase: string): PushPayload {
  const date = occurrenceDate(occurrence, timeZone);
  const day = dayWord(date, dateInZone(dueAt, timeZone));
  let when: string;
  if (occurrence.allDay) when = day;
  else {
    const time = clock(parseInstant(occurrence.start), timeZone);
    when = day === "today" ? time : `${day} at ${time}`;
  }
  return {
    title: `${occurrence.title}, ${when}`,
    body: occurrence.location.trim(),
    url: dayPath(webBase, date),
    // One per occurrence, so two reminders due together don't replace each other.
    tag: `reminder:${occurrence.eventId}:${occurrence.start}`,
  };
}
