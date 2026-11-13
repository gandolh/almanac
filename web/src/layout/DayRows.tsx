import type { Calendar, Occurrence } from "@almanac/shared";
import { Fragment, type CSSProperties } from "react";
import { displayTitle } from "../calendar/events";
import { PlaceIcon } from "../components/icons";
import { calendarColor } from "../data/calendars";
import { RANGE_DASH, formatTime, zonedOf } from "../dates";

/** "07:00 – 07:45", or "All day": the time column of a row. */
export function rowTime(occurrence: Pick<Occurrence, "allDay" | "start" | "end">, timeZone: string): string {
  if (occurrence.allDay) return "All day";
  return `${formatTime(zonedOf(occurrence.start, timeZone))}${RANGE_DASH}${formatTime(zonedOf(occurrence.end, timeZone))}`;
}

/** The start time as "HH:MM" of a timed occurrence, for placing the now rule among the rows. */
function startClock(occurrence: Pick<Occurrence, "start">, timeZone: string): string {
  return formatTime(zonedOf(occurrence.start, timeZone));
}

export interface DayRowsProps {
  occurrences: readonly Occurrence[];
  calendars: readonly Calendar[];
  timeZone: string;
  /** The wall clock now ("10:30") when the list is today's: a rule goes in before the first timed row that starts after it. */
  now?: string | null;
  /** The phone's rows are 48 px and 16 px type. */
  phone?: boolean;
  /** A row was chosen: its occurrence and the row, for the details to sit by. */
  onOpen: (occurrence: Occurrence, anchor: Element) => void;
}

/**
 * One day's occurrences as rows: the time range, the calendar's mark, the
 * title and, under it, the place. The now rule sits among them where the
 * clock is, as the grid's now line does. Each row opens the event's details.
 */
export function DayRows({ occurrences, calendars, timeZone, now = null, phone = false, onOpen }: DayRowsProps) {
  const colors = new Map(calendars.map((calendar) => [calendar.id, calendarColor(calendar)]));
  // The rule goes before the first timed row that starts after now, or last.
  const later = occurrences.findIndex(
    (occurrence) => !occurrence.allDay && startClock(occurrence, timeZone) > (now ?? ""),
  );
  const ruleAt = now === null ? -1 : later < 0 ? occurrences.length : later;
  return (
    <ul className="m-0 mt-1 flex list-none flex-col p-0">
      {occurrences.map((occurrence, index) => {
        return (
          <Fragment key={occurrence.id}>
            {index === ruleAt && <NowRule time={now ?? ""} phone={phone} />}
            <li className="border-t border-hairline">
              <button
                type="button"
                className={
                  phone
                    ? "grid min-h-12 w-full grid-cols-[104px_12px_minmax(0,1fr)] items-start gap-x-2.5 bg-transparent py-3 text-left text-action-large leading-[22px] text-ink hover:bg-hover"
                    : "grid w-full grid-cols-[90px_12px_minmax(0,1fr)] items-start gap-x-2.5 rounded-small bg-transparent py-1.5 text-left text-body leading-5 text-ink hover:bg-hover"
                }
                style={{ "--calendar-color": colors.get(occurrence.calendarId) } as CSSProperties}
                onClick={(event) => onOpen(occurrence, event.currentTarget)}
              >
                <span className="font-num font-medium whitespace-nowrap text-muted tabular-nums">
                  {rowTime(occurrence, timeZone)}
                </span>
                <span
                  className="mt-1 block size-3 flex-none rounded-small bg-[var(--calendar-color,var(--color-accent))] max-md:mt-[5px]"
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold wrap-break-word">{displayTitle(occurrence.title)}</span>
                  {occurrence.location.trim() !== "" && (
                    <span
                      className={
                        phone
                          ? "flex items-center gap-1 text-meta leading-5 text-muted"
                          : "flex items-center gap-1 text-small leading-[18px] text-muted"
                      }
                    >
                      <PlaceIcon size={14} />
                      <span className="min-w-0 wrap-break-word">{occurrence.location}</span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          </Fragment>
        );
      })}
      {ruleAt === occurrences.length && <NowRule time={now ?? ""} phone={phone} />}
    </ul>
  );
}

/** The now rule: the time, right-aligned in the time column, then a 2 px line across. */
function NowRule({ time, phone }: { time: string; phone: boolean }) {
  return (
    <li className="flex items-center border-t border-hairline py-1.5" aria-label={`Now, ${time}`}>
      <span
        className={`${phone ? "w-[104px] text-meta" : "w-[90px] text-small"} mr-2.5 flex-none text-right font-num font-bold text-now-line tabular-nums`}
      >
        {time}
      </span>
      <span className="h-0.5 flex-1 rounded-[2px] bg-now-line" />
    </li>
  );
}
