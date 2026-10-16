import type { DayHeaderInfo } from "@fullcalendar/react";
import { RANGE_DASH, WEEKDAY_SHORT, formatTime } from "../dates";

/**
 * What FullCalendar writes into the views, in Almanac's words: 24-hour
 * times ("14:30", "10:00 – 11:00") and Google's column heads ("MON" over
 * "19"). FullCalendar hands these wall-clock fields already in the display
 * time zone, so no zone maths happens here.
 */

/** A wall-clock time as FullCalendar's formatter functions get it (the display time zone's hour and minute). */
interface WallClock {
  readonly hour: number;
  readonly minute: number;
}

/** The part of FullCalendar's formatter argument these read: one time, or a range. */
export interface FormatArg {
  readonly date: WallClock;
  readonly start: WallClock;
  readonly end?: WallClock | null;
}

/** The hour labels down the side of day and week: "08:00". */
export function slotLabel(arg: FormatArg): string {
  return formatTime(arg.date);
}

/** An event's time: "10:00 – 11:00" in day and week, "10:00" before the title in month. */
export function eventTimeText(arg: FormatArg): string {
  return arg.end ? `${formatTime(arg.start)}${RANGE_DASH}${formatTime(arg.end)}` : formatTime(arg.start);
}

/** "MON" for FullCalendar's day of the week (Sunday 0 … Saturday 6). */
export function weekdayHead(dow: number): string {
  return (WEEKDAY_SHORT[(dow + 6) % 7] ?? "").toUpperCase();
}

export interface DayHeadProps {
  /** Sunday 0 … Saturday 6. */
  dow: number;
  /** "19", or empty in month, whose heads name the weekday only. */
  dayNumber: string;
  today: boolean;
}

/** A column's head: the weekday, and in day and week the date's number under it, today's in the accent disc. */
export function DayHead({ dow, dayNumber, today }: DayHeadProps) {
  return (
    <span className={today ? "cal-head cal-head--today" : "cal-head"}>
      <span className="cal-head__weekday">{weekdayHead(dow)}</span>
      {dayNumber !== "" && <span className="cal-head__day">{dayNumber}</span>}
    </span>
  );
}

/** FullCalendar's `dayHeaderContent`. */
export function dayHeaderContent(info: DayHeaderInfo) {
  return <DayHead dow={info.dow} dayNumber={info.dayNumberText} today={info.isToday} />;
}
