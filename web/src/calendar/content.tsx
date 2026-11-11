import type { DayHeaderInfo } from "@fullcalendar/react";
import { RANGE_DASH, WEEKDAY_SHORT, formatTime } from "../dates";
import { displayTitle } from "./events";

/**
 * What FullCalendar writes into the views, in Almanac's words: 24-hour
 * times ("14:30", "10:00 – 11:00"), Google's column heads ("MON" over
 * "19") and the "(No title)" of a selection's block. FullCalendar hands
 * these wall-clock fields already in the display time zone, so no zone
 * maths happens here.
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
    <span className="group inline-flex flex-col items-center gap-1 pt-1 pb-1.5" data-today={today || undefined}>
      <span className="text-mini font-medium tracking-[0.08em] text-muted group-data-today:text-accent">
        {weekdayHead(dow)}
      </span>
      {dayNumber !== "" && (
        <span className="inline-flex size-day-disc items-center justify-center rounded-pill text-day-number leading-none text-ink-2 transition-[background-color] duration-(--duration-fast) ease-out group-hover:bg-hover group-data-today:bg-accent group-data-today:text-on-accent group-data-today:group-hover:bg-accent max-md:size-day-disc-phone max-md:text-day-number-phone">
          {dayNumber}
        </span>
      )}
    </span>
  );
}

/** FullCalendar's `dayHeaderContent`. */
export function dayHeaderContent(info: DayHeaderInfo) {
  return <DayHead dow={info.dow} dayNumber={info.dayNumberText} today={info.isToday} />;
}

/** The part of FullCalendar's `eventContent` argument read here. */
export interface EventContentArg {
  readonly isMirror: boolean;
  readonly event: { readonly title: string };
  readonly timeText: string;
  readonly timeClass: string;
  readonly titleClass: string;
}

/**
 * FullCalendar's `eventContent`: its own inside of an event (`true`), but
 * for the block a selection draws in day and week, which has no title.
 * There, as in Google's, "(No title)" stands over the time where
 * FullCalendar would leave the first line empty. A dragged event's block
 * keeps its own title.
 */
export function eventContent(info: EventContentArg) {
  if (!info.isMirror || info.event.title !== "") return true;
  return (
    <>
      {info.timeText !== "" && <div className={info.timeClass}>{info.timeText}</div>}
      <div className={info.titleClass}>{displayTitle("")}</div>
    </>
  );
}
