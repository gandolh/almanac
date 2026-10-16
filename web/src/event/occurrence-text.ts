import type { Occurrence } from "@almanac/shared";
import { RANGE_DASH, Temporal, formatDayLong, formatTime, zonedOf } from "../dates";

/** " · " between a day and its times. */
const DOT = " · ";

/**
 * When an occurrence happens, in `timeZone`, as the details popover and
 * quick create write it:
 *
 * - "Friday, 16 October · 10:00 – 11:00" (an end at the next midnight counts as the same day);
 * - "Friday, 16 October, 22:00 – Saturday, 17 October, 02:00";
 * - "Friday, 16 October · All day";
 * - "Friday, 16 October – Sunday, 18 October" (all-day over several days; the end date is exclusive).
 */
export function whenText(occurrence: Pick<Occurrence, "allDay" | "start" | "end">, timeZone: string): string {
  if (occurrence.allDay) {
    const first = Temporal.PlainDate.from(occurrence.start);
    const last = Temporal.PlainDate.from(occurrence.end).subtract({ days: 1 });
    if (Temporal.PlainDate.compare(last, first) <= 0) return `${formatDayLong(first)}${DOT}All day`;
    return `${formatDayLong(first)}${RANGE_DASH}${formatDayLong(last)}`;
  }
  const start = zonedOf(occurrence.start, timeZone);
  const end = zonedOf(occurrence.end, timeZone);
  const startDay = start.toPlainDate();
  const endDay = end.toPlainDate();
  const endsAtNextMidnight =
    Temporal.PlainDate.compare(endDay, startDay.add({ days: 1 })) === 0 && end.hour === 0 && end.minute === 0;
  if (Temporal.PlainDate.compare(startDay, endDay) === 0 || endsAtNextMidnight) {
    return `${formatDayLong(startDay)}${DOT}${formatTime(start)}${RANGE_DASH}${formatTime(end)}`;
  }
  return `${formatDayLong(startDay)}, ${formatTime(start)}${RANGE_DASH}${formatDayLong(endDay)}, ${formatTime(end)}`;
}
