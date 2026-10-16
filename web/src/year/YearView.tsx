import type { Occurrence } from "@almanac/shared";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { isApiError } from "../api";
import { MonthGrid } from "../components/MonthGrid";
import { Popover } from "../components/Popover";
import { showToast } from "../components/Toast";
import { useCalendars } from "../data/calendars";
import { fetchOccurrences, onOccurrencesChanged } from "../data/occurrences";
import { useSettings, useToday } from "../data/settings";
import { Temporal, dateKey, instantRange, monthName, sameDate, visibleRange, type DateSpan } from "../dates";
import { DayList } from "./DayList";
import { markedDays } from "./days";
import "./year.css";

export interface YearViewProps {
  year: number;
  /** A day was chosen: the shell opens the day view on it. */
  onOpenDay(date: Temporal.PlainDate): void;
  /** A month's name was chosen: the shell opens the month view on its 1st. */
  onOpenMonth(date: Temporal.PlainDate): void;
}

/** 1 January to 1 January. */
function yearSpan(year: number): DateSpan {
  return visibleRange("year", Temporal.PlainDate.from({ year, month: 1, day: 1 }));
}

/**
 * The year on one page, Google's year view with what Google leaves out: a
 * dot under every day that has events.
 *
 * - Twelve `MonthGrid`s, four across on a wide screen and fewer as the room
 *   shrinks; a month's name opens that month.
 * - The year's occurrences come from `GET /api/occurrences` for 1 January to
 *   1 January in the display time zone, fetched again after a write
 *   anywhere, and when the year or the time zone changes. A day is marked
 *   when a shown calendar's occurrence is on it (a multi-day event marks
 *   each of its days), as in the month view.
 * - A click on a day opens its list beside it; an event in the list, or
 *   "Open day", goes to the day view.
 */
export function YearView({ year, onOpenDay, onOpenMonth }: YearViewProps) {
  const today = useToday();
  const { timeZone } = useSettings();
  const { calendars } = useCalendars();
  const occurrences = useYearOccurrences(year, timeZone);
  const rootRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [picked, setPicked] = useState<{ date: Temporal.PlainDate; anchor: Element } | null>(null);

  // The list closes when the year or the zone moves on (and stays closed on coming back).
  const place = `${year}/${timeZone}`;
  const [shownAt, setShownAt] = useState(place);
  if (shownAt !== place) {
    setShownAt(place);
    setPicked(null);
  }

  const marked = useMemo(
    () => markedDays(occurrences, calendars, timeZone, yearSpan(year)),
    [occurrences, calendars, timeZone, year],
  );

  const pickDay = (date: Temporal.PlainDate) => {
    // A second click on the open day closes it (the popover leaves a press on its anchor to us).
    if (picked && sameDate(picked.date, date)) {
      setPicked(null);
      return;
    }
    const anchor = rootRef.current?.querySelector(`button[data-date="${dateKey(date)}"]`);
    if (anchor) setPicked({ date, anchor });
  };

  return (
    <section ref={rootRef} className="year" aria-label={`Year ${year}`}>
      <div className="year__months">
        {Array.from({ length: 12 }, (_, index) => (
          <YearMonth
            key={index}
            month={Temporal.PlainYearMonth.from({ year, month: index + 1 })}
            today={today}
            marked={marked}
            onPickDay={pickDay}
            onOpenMonth={onOpenMonth}
          />
        ))}
      </div>
      {picked && (
        <Popover anchor={picked.anchor} onClose={() => setPicked(null)} labelledBy={titleId} className="day-popover">
          <DayList
            date={picked.date}
            occurrences={occurrences}
            calendars={calendars}
            timeZone={timeZone}
            titleId={titleId}
            onOpenDay={onOpenDay}
          />
        </Popover>
      )}
    </section>
  );
}

interface YearMonthProps {
  month: Temporal.PlainYearMonth;
  today: Temporal.PlainDate;
  marked: ReadonlySet<string>;
  onPickDay(date: Temporal.PlainDate): void;
  onOpenMonth(date: Temporal.PlainDate): void;
}

/** One month: its name, a button that opens it, over its days. */
function YearMonth({ month, today, marked, onPickDay, onOpenMonth }: YearMonthProps) {
  const titleId = useId();
  return (
    <div className="year-month">
      <button type="button" id={titleId} className="year-month__title" onClick={() => onOpenMonth(month.toPlainDate({ day: 1 }))}>
        {monthName(month.month)}
      </button>
      <MonthGrid month={month} today={today} marked={marked} onPickDay={onPickDay} size="year" labelledBy={titleId} />
    </div>
  );
}

/**
 * The occurrences overlapping `year` in `timeZone`. The last answer stays
 * while the next is fetched (a dot doesn't blink out on every edit); a
 * failure is a toast with Retry.
 */
function useYearOccurrences(year: number, timeZone: string): readonly Occurrence[] {
  const [occurrences, setOccurrences] = useState<readonly Occurrence[]>([]);
  const [version, setVersion] = useState(0);

  // A write anywhere: fetch again.
  useEffect(() => onOccurrencesChanged(() => setVersion((current) => current + 1)), []);

  useEffect(() => {
    const controller = new AbortController();
    const { from, to } = instantRange(yearSpan(year), timeZone);
    fetchOccurrences(from, to, { signal: controller.signal }).then(
      (found) => {
        if (!controller.signal.aborted) setOccurrences(found);
      },
      (error: unknown) => {
        // Superseded by a newer request, or signed out (the login page takes over).
        if (controller.signal.aborted || isApiError(error, "signed_out")) return;
        showToast(isApiError(error) ? error.message : "Your events couldn't be loaded.", {
          action: { label: "Retry", onAction: () => setVersion((current) => current + 1) },
        });
      },
    );
    return () => controller.abort();
  }, [year, timeZone, version]);

  return occurrences;
}
