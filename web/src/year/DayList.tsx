import type { Calendar, Occurrence } from "@almanac/shared";
import type { CSSProperties, MouseEvent } from "react";
import { displayTitle } from "../calendar/events";
import { calendarColor } from "../data/calendars";
import { formatDayLong, type Temporal } from "../dates";
import { hrefFor, viewRoute } from "../router";
import { occurrencesOn, timeLabel } from "./days";

export interface DayListProps {
  date: Temporal.PlainDate;
  /** What was fetched for the year; the list picks out the day's, on shown calendars. */
  occurrences: readonly Occurrence[];
  calendars: readonly Calendar[];
  timeZone: string;
  /** The id the popover names itself by: the day's heading. */
  titleId: string;
  /** An event, or "Open day", was chosen: the day view on `date`. */
  onOpenDay: (date: Temporal.PlainDate) => void;
}

/**
 * What the year view's popover holds for a day: its heading ("Friday, 16
 * October"), then its events in start order, each with its calendar's colour,
 * "All day" or the 24-hour start time, and the title; "No events" when
 * there are none; and "Open day" to go to the day view. A click on an event
 * goes there too.
 */
export function DayList({ date, occurrences, calendars, timeZone, titleId, onOpenDay }: DayListProps) {
  const events = occurrencesOn(date, occurrences, calendars, timeZone);
  const colors = new Map(calendars.map((calendar) => [calendar.id, calendarColor(calendar)]));

  const openDay = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab, or a new window: the browser's.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onOpenDay(date);
  };

  return (
    // Focus lands on the panel, not on a button, as the event details' popover does.
    <div className="flex flex-col px-2 pt-3 pb-2 focus:outline-none" tabIndex={-1} data-autofocus="">
      <h2 id={titleId} className="px-2 pb-2 text-body leading-tight font-medium text-ink">
        {formatDayLong(date)}
      </h2>
      {events.length === 0 ? (
        <p className="px-2 pt-1 pb-3 text-meta text-muted">No events</p>
      ) : (
        <ul className="flex flex-col">
          {events.map((occurrence) => (
            <li key={occurrence.id}>
              <button
                type="button"
                className="flex min-h-8 w-full items-center gap-2.5 rounded-small bg-transparent px-2 py-1 text-left text-meta text-ink transition-[background-color] duration-(--duration-fast) ease-out hover:bg-hover"
                style={{ "--calendar-color": colors.get(occurrence.calendarId) } as CSSProperties}
                onClick={() => onOpenDay(date)}
              >
                <span
                  className="size-search-dot flex-none rounded-pill bg-[var(--calendar-color,var(--color-accent))]"
                  aria-hidden="true"
                />
                <span className="min-w-[52px] flex-none text-ink-2 tabular-nums">
                  {timeLabel(occurrence, timeZone)}
                </span>
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  {displayTitle(occurrence.title)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <a
        className="mt-2 self-start rounded-small px-2 py-1.5 text-meta font-medium text-accent no-underline hover:bg-accent-tint-soft"
        href={hrefFor(viewRoute("day", date))}
        onClick={openDay}
      >
        Open day
      </a>
    </div>
  );
}
