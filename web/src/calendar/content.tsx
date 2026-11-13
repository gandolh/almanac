import type { DayHeaderInfo } from "@fullcalendar/react";
import { useLayoutEffect, useRef, useState } from "react";
import { RANGE_DASH, WEEKDAY_SHORT, formatTime } from "../dates";
import { displayTitle } from "./events";

/**
 * What FullCalendar writes into the views, in Almanac's words: 24-hour
 * times ("14:30", "10:00 – 11:00"), column heads ("Mon" over "9") and the
 * "(No title)" of a selection's block. FullCalendar hands these wall-clock
 * fields already in the display time zone, so no zone maths happens here.
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

/** "Mon" for FullCalendar's day of the week (Sunday 0 … Saturday 6). */
export function weekdayHead(dow: number): string {
  return WEEKDAY_SHORT[(dow + 6) % 7] ?? "";
}

export interface DayHeadProps {
  /** Sunday 0 … Saturday 6. */
  dow: number;
  /** "9", or empty in month, whose heads name the weekday only. */
  dayNumber: string;
  today: boolean;
}

/**
 * A column's head: the weekday in sentence case, and in day and week the
 * date's number under it in Condensed. Today's head sits on the accent tint
 * (its cell does, in `CalendarArea`) and its number on an accent tab.
 */
export function DayHead({ dow, dayNumber, today }: DayHeadProps) {
  return (
    <span
      className={`group flex flex-col items-center justify-center gap-0.5 ${dayNumber === "" ? "h-9" : "h-14 max-md:h-12"}`}
      data-today={today || undefined}
    >
      <span className="text-small leading-4 font-medium text-muted group-data-today:font-bold group-data-today:text-accent-ink">
        {weekdayHead(dow)}
      </span>
      {dayNumber !== "" && (
        <span className="min-w-[34px] rounded-[8px] px-1.5 text-center font-num text-day-number leading-[26px] font-semibold text-ink transition-[background-color] duration-(--duration-fast) ease-out group-hover:bg-hover group-data-today:bg-accent group-data-today:font-bold group-data-today:text-on-accent group-data-today:group-hover:bg-accent">
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
  readonly event: {
    readonly title: string;
    readonly allDay: boolean;
    readonly start: Date | null;
    readonly end: Date | null;
  };
  readonly view: { readonly type: string };
  readonly timeText: string;
  readonly timeClass: string;
  readonly titleClass: string;
}

/** A timed block this long or longer holds its title and its time range on two lines. */
const TWO_LINES_FROM_MINUTES = 45;
/** From this long the time line is the 12 px one; below it, a 45-minute block's 11 px. */
const FULL_TIME_FROM_MINUTES = 60;

/** "10:00" of "10:00 – 11:00". */
function startOf(timeText: string): string {
  return timeText.split(RANGE_DASH)[0] ?? timeText;
}

/** The minutes an event lasts, 30 when FullCalendar has no end. */
function minutesOf(event: EventContentArg["event"]): number {
  if (!event.start || !event.end) return 30;
  return (event.end.getTime() - event.start.getTime()) / 60_000;
}

/**
 * FullCalendar's `eventContent`. A timed block in day and week keeps every
 * start time and never an ellipsis:
 *
 * - 45 minutes or more: the title, then the time on a second line: the
 *   start in 11/14 under an hour, the range in 12/16 from it;
 * - shorter: one line, the title then the start time, and the time drops
 *   out (the title stays) where the block is under 120 px wide.
 *
 * Month and the all-day row keep FullCalendar's own (`true`), but for the
 * block a selection draws, which has no title: there "(No title)" stands
 * over the time. A dragged event's block keeps its own title.
 */
export function eventContent(info: EventContentArg) {
  if (info.isMirror && info.event.title === "") {
    return (
      <>
        {info.timeText !== "" && <div className={info.timeClass}>{info.timeText}</div>}
        <div className={info.titleClass}>{displayTitle("")}</div>
      </>
    );
  }
  if (info.event.allDay || !info.view.type.startsWith("timeGrid")) return true;
  const minutes = minutesOf(info.event);
  if (minutes >= TWO_LINES_FROM_MINUTES) {
    const short = minutes < FULL_TIME_FROM_MINUTES;
    return <TwoLines title={info.event.title} time={short ? startOf(info.timeText) : info.timeText} short={short} />;
  }
  return (
    <div className="flex h-full min-w-0 items-center gap-1 px-[5px] whitespace-nowrap">
      <span className="text-event leading-[18px] font-semibold">{info.event.title}</span>
      <span className="hidden font-num text-event-time leading-4 font-medium @min-[120px]/ev:inline">
        {startOf(info.timeText)}
      </span>
    </div>
  );
}

/**
 * A block of 45 minutes or more: the title, then its time line, unless the
 * block is too small for both (a long title wrapped in a narrow column): then
 * the title stays alone and the time is in the details. Measured, so it
 * follows the column's width.
 */
function TwoLines({ title, time, short }: { title: string; time: string; short: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const titleEl = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const box = root.current?.parentElement;
    const line = titleEl.current;
    if (!box || !line) return;
    const timeHeight = short ? 14 : 16;
    const check = () => setFits(line.offsetTop + line.offsetHeight + timeHeight <= box.clientHeight);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(box);
    return () => observer.disconnect();
  }, [title, short]);
  return (
    <div ref={root} className="flex h-full min-w-0 flex-col px-[5px] pt-1">
      <div ref={titleEl} className="text-event leading-[18px] font-semibold wrap-break-word">
        {title}
      </div>
      {fits && (
        <div
          className={`font-num font-medium whitespace-nowrap ${short ? "text-[11px] leading-3.5" : "text-event-time leading-4"}`}
        >
          {time}
        </div>
      )}
    </div>
  );
}
